from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import json

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
IMPORT_ROOT = ROOT / "data-imports" / "official-word-bank"
RAW_PATH = IMPORT_ROOT / "official-word-bank.raw.json"
SITE_WORDS_PATH = ROOT / "site" / "data" / "words.json"
QUEUE_PATH = IMPORT_ROOT / "official-word-bank.review-queue.json"
REPORT_PATH = IMPORT_ROOT / "review-queue-report.md"


TOPIC_RULES = [
    ("food", "食物", ["食", "餐", "乳", "甜", "奶", "餅", "麵", "菜", "飯", "喝", "飲", "蛋", "肉", "瓜"]),
    ("animal", "動物", ["動物", "鳥", "魚", "龍", "鴨", "驢", "豚", "恐龍", "蜻蜓"]),
    ("school", "學校", ["學", "課", "書", "文憑", "字典", "討論", "示範"]),
    ("technology", "科技", ["資料", "數據", "裝置", "設備", "下載", "數位", "無人機"]),
    ("health", "健康", ["醫", "牙", "疾病", "診斷", "消化", "劑量"]),
    ("safety", "安全", ["危險", "防禦", "保衛", "災難", "損害", "破壞"]),
    ("place", "地點", ["地區", "行政區", "市中心", "碼頭", "目的地", "沙漠", "甲板"]),
    ("time", "時間", ["每日", "每天", "黎明", "十年", "期限", "持續時間", "期間"]),
    ("feeling", "心情", ["欣喜", "愉快", "沮喪", "失望", "厭惡", "絕望"]),
    ("action", "動作", ["決定", "分配", "分解", "裝飾", "描述", "發現", "打擾", "跳舞"]),
]


def read_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def source_key(source_letter: object, source_no: object) -> str:
    return f"{str(source_letter)}{int(source_no):03d}"


def proposed_official_id(source_letter: object, source_no: object) -> str:
    return f"O{str(source_letter)}{int(source_no):03d}"


def normalize_word(value: object) -> str:
    return str(value or "").strip().lower()


def normalize_pos(value: object) -> str:
    text = str(value or "").strip().replace("/", " ")
    while "  " in text:
        text = text.replace("  ", " ")
    return text


def split_meanings(value: object) -> list[str]:
    text = str(value or "").strip()
    segments: list[str] = []
    current: list[str] = []
    for char in text:
        if char in {"／", "/"}:
            item = "".join(current).strip()
            if item:
                segments.append(item)
            current = []
        else:
            current.append(char)
    item = "".join(current).strip()
    if item:
        segments.append(item)
    return segments or [text]


def derive_level(word: object, starred: object) -> str:
    if bool(starred):
        return "bridge"
    letters = str(word or "").replace("-", "").replace(" ", "")
    if len(letters) <= 6:
        return "starter"
    if len(letters) <= 10:
        return "bridge"
    return "challenge"


def infer_topic(primary_zh: str) -> tuple[str, str]:
    for topic, topic_zh, keywords in TOPIC_RULES:
        for keyword in keywords:
            if keyword in primary_zh:
                return topic, topic_zh
    return "general", "一般"


def build_existing_word_map(site_words: list[dict[str, object]]) -> dict[str, dict[str, object]]:
    existing: dict[str, dict[str, object]] = {}
    for word in site_words:
        existing[normalize_word(word.get("word"))] = word
    return existing


def build_queue_entries(raw_entries: list[dict[str, object]], site_words: list[dict[str, object]]) -> list[dict[str, object]]:
    existing_by_word = build_existing_word_map(site_words)
    entries: list[dict[str, object]] = []
    for raw in raw_entries:
        meanings = split_meanings(raw.get("zhRaw"))
        primary_zh = meanings[0] if meanings else str(raw.get("zhRaw", "")).strip()
        topic, topic_zh = infer_topic(primary_zh)
        existing = existing_by_word.get(normalize_word(raw.get("word")))
        action = "already-live" if existing else "needs-review"
        source_letter = raw.get("sourceLetter")
        source_no = raw.get("sourceNo")
        candidate_id = str(existing.get("id")) if existing else proposed_official_id(source_letter, source_no)
        entry = {
            "sourceKey": source_key(source_letter, source_no),
            "sourceLetter": source_letter,
            "sourceNo": source_no,
            "word": raw.get("word"),
            "posRaw": raw.get("pos"),
            "zhRaw": raw.get("zhRaw"),
            "starred": raw.get("starred"),
            "sourcePage": raw.get("sourcePage"),
            "sourceRow": raw.get("sourceRow"),
            "action": action,
            "existingSiteId": existing.get("id") if existing else None,
            "candidate": {
                "id": candidate_id,
                "word": raw.get("word"),
                "pos": normalize_pos(raw.get("pos")),
                "zh": primary_zh,
                "zhAlternatives": meanings[1:],
                "zhuyin": existing.get("zhuyin") if existing else "",
                "source": f"Official-{source_letter}-{int(source_no)}",
                "level": existing.get("level") if existing else derive_level(raw.get("word"), raw.get("starred")),
                "topic": existing.get("topic") if existing else topic,
                "topicZh": existing.get("topicZh") if existing else topic_zh,
                "topicZhuyin": existing.get("topicZhuyin") if existing else "",
                "starred": raw.get("starred"),
                "example": existing.get("example") if existing else "",
                "usage": existing.get("usage") if existing else "",
                "reviewStatus": "approved" if existing else "needs_review",
            },
            "reviewChecklist": [
                "confirm-source-spelling",
                "confirm-pos",
                "confirm-traditional-chinese-meaning",
                "add-taiwan-bopomofo",
                "add-grade-appropriate-example",
                "add-usage-context",
                "run-official-review-validation",
            ],
        }
        entries.append(entry)
    return entries


def build_report(entries: list[dict[str, object]], site_words: list[dict[str, object]]) -> str:
    frame = pd.DataFrame(entries)
    raw_words = set(frame["word"].astype(str).str.lower().tolist())
    site_only = [
        f"{word.get('id')}:{word.get('word')}"
        for word in site_words
        if normalize_word(word.get("word")) not in raw_words
    ]
    by_letter = (
        frame.groupby(["sourceLetter", "action"])
        .size()
        .unstack(fill_value=0)
        .reset_index()
        .to_dict(orient="records")
    )
    lines = [
        "# Official Word Bank Review Queue",
        "",
        f"- Generated at: {datetime.now(timezone.utc).isoformat()}",
        f"- Raw entries: {len(entries)}",
        f"- Already live in site/data/words.json: {int((frame['action'] == 'already-live').sum())}",
        f"- Needs reviewed conversion: {int((frame['action'] == 'needs-review').sum())}",
        f"- Site-only words not found in official raw: {len(site_only)}",
        "",
        "## Counts By Letter",
        "",
        "| Letter | Already live | Needs review |",
        "| --- | ---: | ---: |",
    ]
    for row in by_letter:
        lines.append(
            f"| {row.get('sourceLetter')} | {int(row.get('already-live', 0))} | {int(row.get('needs-review', 0))} |"
        )
    lines.extend(["", "## Site-Only Words"])
    if site_only:
        for item in site_only:
            lines.append(f"- {item}")
    else:
        lines.append("- None")
    lines.extend([
        "",
        "## Next Step",
        "",
        "Move `needs-review` entries into approved batches only after spelling, POS, Traditional Chinese meaning, Taiwan zhuyin, example, and usage are checked.",
    ])
    return "\n".join(lines) + "\n"


def main() -> None:
    raw_payload = read_json(RAW_PATH)
    raw_entries = raw_payload.get("entries", []) if isinstance(raw_payload, dict) else []
    site_words = read_json(SITE_WORDS_PATH)
    if not isinstance(site_words, list):
        raise TypeError("site/data/words.json must be a list.")
    entries = build_queue_entries(raw_entries, site_words)
    payload = {
        "metadata": {
            "kind": "official-word-bank-review-queue",
            "status": "needs-review",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "rawEntryCount": len(raw_entries),
            "siteWordCount": len(site_words),
            "note": "This file is a review queue. It must not be merged directly into site/data/words.json.",
        },
        "entries": entries,
    }
    write_json(QUEUE_PATH, payload)
    REPORT_PATH.write_text(build_report(entries, site_words), encoding="utf-8")
    frame = pd.DataFrame(entries)
    print("PASSED")
    print(f"queue={QUEUE_PATH}")
    print(f"report={REPORT_PATH}")
    print(f"raw_entries={len(entries)}")
    print(f"already_live={int((frame['action'] == 'already-live').sum())}")
    print(f"needs_review={int((frame['action'] == 'needs-review').sum())}")


if __name__ == "__main__":
    main()
