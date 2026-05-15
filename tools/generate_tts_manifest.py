import argparse
import asyncio
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
WORDS_PATH = ROOT_DIR / "site" / "data" / "words.json"
AUDIO_ROOT_REL = "assets/audio/generated"
MANIFEST_PATH = ROOT_DIR / "site" / "data" / "audio-manifest.json"

DEFAULT_ENGLISH_VOICE = "en-US-JennyNeural"
DEFAULT_CHINESE_VOICE = "zh-TW-HsiaoChenNeural"
ENGLISH_RATE = "-8%"
CHINESE_RATE = "-4%"
DEFAULT_VOLUME = "+25%"
DEFAULT_PITCH = "+0Hz"

BASE_UI_CLIP_TYPES = [
    "word",
    "example",
    "meaningZh",
    "topicZh",
    "exampleZh",
    "examHintZh",
]
FALLBACK_USAGE_CLIP_TYPES = ["usage", "usageZh"]


@dataclass(frozen=True)
class ClipSpec:
    word_id: str
    clip_type: str
    text: str
    lang: str
    voice: str
    rate: str
    volume: str
    pitch: str


def load_json(path):
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write("\n")


def safe_path_part(value):
    output = []
    for char in str(value):
        if char.isalnum() or char in ["-", "_"]:
            output.append(char)
        else:
            output.append("_")
    safe = "".join(output).strip("_")
    if safe:
        return safe
    raise ValueError(f"Cannot build safe path part from {value!r}")


def normalize_text(value):
    return " ".join(str(value or "").split()).strip()


def read_words():
    payload = load_json(WORDS_PATH)
    if not isinstance(payload, list):
        raise ValueError("words.json must contain a list.")
    words = []
    seen_ids = set()
    for index, word in enumerate(payload):
        if not isinstance(word, dict):
            raise ValueError(f"Word row {index + 1} is not an object.")
        word_id = normalize_text(word.get("id"))
        text = normalize_text(word.get("word"))
        if not word_id or not text:
            raise ValueError(f"Word row {index + 1} is missing id or word.")
        if word_id in seen_ids:
            raise ValueError(f"Duplicate word id: {word_id}")
        seen_ids.add(word_id)
        words.append(word)
    return words


def is_approved_learning_content(word):
    review = word.get("contentReview")
    return isinstance(review, dict) and review.get("status") == "approved"


def approved_contexts(word):
    contexts = word.get("contexts")
    if not is_approved_learning_content(word) or not isinstance(contexts, list):
        return []
    approved = []
    for context in contexts:
        if not isinstance(context, dict) or context.get("reviewStatus") != "approved":
            continue
        required_values = [
            context.get("id"),
            context.get("labelZh"),
            context.get("labelZhuyin"),
            context.get("sentence"),
            context.get("sentenceZh"),
            context.get("sentenceZhuyin"),
            context.get("usageZh"),
            context.get("usageZhuyin"),
        ]
        if all(normalize_text(value) for value in required_values):
            approved.append(context)
    return approved


def english_spec(word, clip_type, text):
    return ClipSpec(
        word_id=word["id"],
        clip_type=clip_type,
        text=normalize_text(text),
        lang="en-US",
        voice=DEFAULT_ENGLISH_VOICE,
        rate=ENGLISH_RATE,
        volume=DEFAULT_VOLUME,
        pitch=DEFAULT_PITCH,
    )


def chinese_spec(word, clip_type, text):
    return ClipSpec(
        word_id=word["id"],
        clip_type=clip_type,
        text=normalize_text(text),
        lang="zh-TW",
        voice=DEFAULT_CHINESE_VOICE,
        rate=CHINESE_RATE,
        volume=DEFAULT_VOLUME,
        pitch=DEFAULT_PITCH,
    )


def example_chinese_text(word):
    example_zh = normalize_text(word.get("exampleZh"))
    if is_approved_learning_content(word) and example_zh:
        return f"英文例句中文翻譯。{example_zh}"
    return (
        f"英文例句提示。這個單字是 {word['word']}，"
        f"意思是 {word.get('zh', '')}，情境是 {word.get('topicZh', '')}。"
        f"英文例句是：{word.get('example', '')}"
    )


def usage_chinese_text(word):
    return f"應用任務。用 {word['word']} 表達「{word.get('zh', '')}」這個意思。"


def exam_hint_chinese_text(word):
    return (
        f"提示。意思是 {word.get('zh', '')}。"
        f"情境是 {word.get('topicZh', '')}。"
        f"詞性是 {word.get('pos', '')}。"
    )


def context_chinese_text(context):
    return f"應用任務。{context.get('usageZh', '')} 英文句子中文翻譯。{context.get('sentenceZh', '')}"


def context_audio_clip_type(context, target):
    return f"context-{context['id']}-{target}"


def specs_for_word(word, profile):
    specs = [
        english_spec(word, "word", word.get("word", "")),
        english_spec(word, "example", word.get("example", "")),
        chinese_spec(word, "meaningZh", f"意思。{word.get('zh', '')}。"),
        chinese_spec(word, "topicZh", f"情境。{word.get('topicZh', '')}。"),
        chinese_spec(word, "exampleZh", example_chinese_text(word)),
        chinese_spec(word, "examHintZh", exam_hint_chinese_text(word)),
    ]
    if profile == "word":
        return [specs[0]]
    contexts = approved_contexts(word)
    if contexts:
        for context in contexts:
            specs.append(english_spec(word, context_audio_clip_type(context, "en"), context.get("sentence", "")))
            specs.append(chinese_spec(word, context_audio_clip_type(context, "zh"), context_chinese_text(context)))
    else:
        specs.append(english_spec(word, "usage", word.get("usage", "")))
        specs.append(chinese_spec(word, "usageZh", usage_chinese_text(word)))
    return specs


def specs_for_words(words, profile):
    specs = []
    seen = set()
    for word in words:
        for spec in specs_for_word(word, profile):
            key = (spec.word_id, spec.clip_type)
            if key in seen:
                raise ValueError(f"Duplicate clip key: {spec.word_id}:{spec.clip_type}")
            seen.add(key)
            if not spec.text:
                raise ValueError(f"Missing TTS text: {spec.word_id}:{spec.clip_type}")
            specs.append(spec)
    return specs


def clip_relative_path(spec):
    word_id = safe_path_part(spec.word_id)
    clip_type = safe_path_part(spec.clip_type)
    return f"{AUDIO_ROOT_REL}/{clip_type}/{word_id}.mp3"


def clip_file_path(spec):
    return ROOT_DIR / "site" / clip_relative_path(spec)


def load_existing_manifest():
    if not MANIFEST_PATH.exists():
        return {}
    payload = load_json(MANIFEST_PATH)
    return payload if isinstance(payload, dict) else {}


async def synthesize_edge_tts(spec, output_path, retries):
    try:
        import edge_tts
    except ImportError as exc:
        raise RuntimeError(
            "edge-tts is not installed. Install locked versions with: "
            "py -3.13 -m pip install --user -r tools/requirements-tts.txt"
        ) from exc

    output_path.parent.mkdir(parents=True, exist_ok=True)
    last_error = None
    for attempt in range(1, retries + 2):
        try:
            communicate = edge_tts.Communicate(
                spec.text,
                voice=spec.voice,
                rate=spec.rate,
                volume=spec.volume,
                pitch=spec.pitch,
            )
            await communicate.save(str(output_path))
            if output_path.exists() and output_path.stat().st_size > 500:
                return
            last_error = RuntimeError(f"Generated file is too small: {output_path}")
        except Exception as exc:
            last_error = exc
        if attempt <= retries:
            await asyncio.sleep(1.5 * attempt)
    raise RuntimeError(f"Failed to generate {output_path}: {last_error}")


def build_manifest(words, profile):
    existing = load_existing_manifest()
    existing_clips = existing.get("clips") if isinstance(existing.get("clips"), dict) else {}
    manifest = {
        "schemaVersion": "2026.1",
        "audioRoot": AUDIO_ROOT_REL,
        "generatedBy": "tools/generate_tts_manifest.py",
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "provider": "edge-tts",
        "profile": profile,
        "voices": {
            "en-US": DEFAULT_ENGLISH_VOICE,
            "zh-TW": DEFAULT_CHINESE_VOICE,
        },
        "fallback": "browser-speechSynthesis",
        "clips": {},
    }
    for spec in specs_for_words(words, profile):
        output_path = clip_file_path(spec)
        if not output_path.exists() or output_path.stat().st_size <= 500:
            continue
        word_clips = manifest["clips"].setdefault(spec.word_id, {})
        existing_clip = None
        if isinstance(existing_clips.get(spec.word_id), dict):
            existing_clip = existing_clips[spec.word_id].get(spec.clip_type)
        clip_payload = {
            "path": clip_relative_path(spec),
            "text": spec.text,
            "lang": spec.lang,
            "provider": "edge-tts",
            "voice": spec.voice,
        }
        if isinstance(existing_clip, dict) and existing_clip.get("path") == clip_payload["path"]:
            clip_payload.update(existing_clip)
            clip_payload["text"] = spec.text
            clip_payload["lang"] = spec.lang
            clip_payload["voice"] = existing_clip.get("voice") or spec.voice
        word_clips[spec.clip_type] = clip_payload
    return manifest


def validate_manifest(words, profile, require_complete):
    manifest = load_existing_manifest()
    clips = manifest.get("clips") if isinstance(manifest.get("clips"), dict) else {}
    required_specs = specs_for_words(words, profile)
    word_ids = set(word["id"] for word in words)
    missing = []
    stale = []
    bad_files = []
    clip_count = 0
    for clip_word_id in clips:
        if clip_word_id not in word_ids:
            stale.append(clip_word_id)
    for spec in required_specs:
        word_clips = clips.get(spec.word_id)
        if not isinstance(word_clips, dict) or spec.clip_type not in word_clips:
            missing.append(f"{spec.word_id}:{spec.clip_type}")
            continue
        clip = word_clips[spec.clip_type]
        path = clip.get("path") if isinstance(clip, dict) else ""
        if not path or path.startswith("/") or ".." in path:
            bad_files.append(f"{spec.word_id}:{spec.clip_type}:bad-path")
            continue
        file_path = ROOT_DIR / "site" / path
        if not file_path.exists() or file_path.stat().st_size <= 500:
            bad_files.append(f"{spec.word_id}:{spec.clip_type}:missing-file")
            continue
        clip_count += 1
    if stale or bad_files or (require_complete and missing):
        print("FAILED audio_manifest=invalid")
        print(f"profile={profile}")
        print(f"words={len(words)}")
        print(f"required_clips={len(required_specs)}")
        print(f"missing={len(missing)}")
        print(f"stale={len(stale)}")
        print(f"bad_files={len(bad_files)}")
        if missing:
            print("missing_sample=" + ", ".join(missing[:12]))
        if stale:
            print("stale_sample=" + ", ".join(stale[:12]))
        if bad_files:
            print("bad_file_sample=" + ", ".join(bad_files[:12]))
        raise SystemExit(1)
    print("PASSED audio_manifest=ok")
    print(f"profile={profile}")
    print(f"words={len(words)}")
    print(f"required_clips={len(required_specs)}")
    print(f"clips={clip_count}")
    print(f"missing={len(missing)}")


async def generate(args):
    words = read_words()
    selected_words = words[:args.limit] if args.limit else words
    selected_specs = specs_for_words(selected_words, args.profile)
    generated = 0
    skipped = 0
    failed = []
    pending = []
    for spec in selected_specs:
        output_path = clip_file_path(spec)
        if args.skip_existing and output_path.exists() and output_path.stat().st_size > 500:
            skipped += 1
            continue
        pending.append(spec)

    lock = asyncio.Lock()
    progress = {"done": 0, "generated": 0}

    async def worker(spec):
        output_path = clip_file_path(spec)
        try:
            await synthesize_edge_tts(spec, output_path, args.retries)
            async with lock:
                progress["generated"] += 1
        except Exception as exc:
            async with lock:
                failed.append(f"{spec.word_id}:{spec.clip_type}:{exc}")
        async with lock:
            progress["done"] += 1
            if not args.quiet and (progress["done"] == 1 or progress["done"] % args.progress_every == 0):
                print(f"progress {progress['done']}/{len(pending)} generated={progress['generated']} failed={len(failed)}")

    semaphore = asyncio.Semaphore(args.concurrency)

    async def guarded_worker(spec):
        async with semaphore:
            await worker(spec)

    await asyncio.gather(*(guarded_worker(spec) for spec in pending))
    generated = progress["generated"]
    if failed:
        print("FAILED tts_generation=partial")
        print(f"selected_words={len(selected_words)}")
        print(f"selected_clips={len(selected_specs)}")
        print(f"generated={generated}")
        print(f"skipped={skipped}")
        print(f"failed={len(failed)}")
        print("failed_sample=" + "\n".join(failed[:12]))
        raise SystemExit(1)

    manifest = build_manifest(words, args.profile)
    write_json(MANIFEST_PATH, manifest)
    total_clips = sum(len(word_clips) for word_clips in manifest["clips"].values())
    print("PASSED tts_generation=ok")
    print(f"profile={args.profile}")
    print(f"selected_words={len(selected_words)}")
    print(f"selected_clips={len(selected_specs)}")
    print(f"generated={generated}")
    print(f"skipped={skipped}")
    print(f"manifest_words={len(manifest['clips'])}")
    print(f"manifest_clips={total_clips}")


def main():
    parser = argparse.ArgumentParser(description="Generate static TTS clips and audio-manifest.json.")
    parser.add_argument("--profile", choices=["word", "ui-all"], default="word")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--progress-every", type=int, default=100)
    parser.add_argument("--skip-existing", action="store_true")
    parser.add_argument("--quiet", action="store_true")
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument("--require-complete", action="store_true")
    args = parser.parse_args()
    if args.validate_only:
        validate_manifest(read_words(), args.profile, args.require_complete)
        return
    asyncio.run(generate(args))


if __name__ == "__main__":
    main()
