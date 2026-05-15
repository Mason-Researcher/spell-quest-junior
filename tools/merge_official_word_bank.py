from __future__ import annotations

from pathlib import Path
import json
import subprocess
import sys

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
IMPORT_ROOT = ROOT / "data-imports" / "official-word-bank"
REVIEWED_PATH = IMPORT_ROOT / "official-word-bank.reviewed.json"
SITE_WORDS_PATH = ROOT / "site" / "data" / "words.json"
PREVIEW_OUTPUT = IMPORT_ROOT / "words.official-merged.preview.json"


REQUIRED_COLUMNS = [
    "id",
    "word",
    "pos",
    "zh",
    "zhuyin",
    "source",
    "level",
    "topic",
    "topicZh",
    "topicZhuyin",
    "starred",
    "example",
    "usage",
    "reviewStatus",
]


def read_reviewed_entries() -> list[dict[str, object]]:
    payload = json.loads(REVIEWED_PATH.read_text(encoding="utf-8"))
    return payload.get("entries", [])


def fail(messages: list[str]) -> None:
    if messages:
        print("FAILED")
        for message in messages:
            print(f"- {message}")
        raise SystemExit(1)


def validate_merge_ready(entries: list[dict[str, object]], existing_words: list[dict[str, object]]) -> None:
    messages: list[str] = []
    if not entries:
        messages.append("No reviewed entries to merge.")
        fail(messages)
    frame = pd.DataFrame(entries)
    missing = [column for column in REQUIRED_COLUMNS if column not in frame.columns]
    if missing:
        messages.append(f"Reviewed entries missing columns: {missing}")
        fail(messages)
    not_approved = frame.loc[frame["reviewStatus"] != "approved", "word"].tolist()
    if not_approved:
        messages.append(f"Entries are not approved: {not_approved[:20]}")
    existing = pd.DataFrame(existing_words)
    existing_ids = set(existing["id"].astype(str).tolist())
    incoming_ids = set(frame["id"].astype(str).tolist())
    duplicate_ids = sorted(existing_ids & incoming_ids)
    if duplicate_ids:
        messages.append(f"Duplicate ids with site words: {duplicate_ids[:20]}")
    existing_word_set = set(existing["word"].astype(str).str.lower().tolist())
    incoming_word_set = set(frame["word"].astype(str).str.lower().tolist())
    duplicate_words = sorted(existing_word_set & incoming_word_set)
    if duplicate_words:
        messages.append(f"Duplicate words with site words: {duplicate_words[:20]}")
    fail(messages)


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run_sync_pairs_on_preview() -> None:
    # The preview file is checked by loading JSON only. bpmf-pair generation is done after final words.json replacement.
    json.loads(PREVIEW_OUTPUT.read_text(encoding="utf-8"))


def main() -> None:
    apply_merge = "--apply-reviewed" in sys.argv
    entries = read_reviewed_entries()
    existing_words = json.loads(SITE_WORDS_PATH.read_text(encoding="utf-8"))
    validate_merge_ready(entries, existing_words)
    merged = existing_words + entries
    if apply_merge:
        backup_path = SITE_WORDS_PATH.with_suffix(".before-official-merge.json")
        if not backup_path.exists():
            write_json(backup_path, existing_words)
        write_json(SITE_WORDS_PATH, merged)
        subprocess.run(["node", "tools/sync_zhuyin_pairs.js"], cwd=str(ROOT), check=True)
        print("PASSED")
        print(f"updated={SITE_WORDS_PATH}")
        print(f"backup={backup_path}")
        print(f"words={len(merged)}")
        return
    write_json(PREVIEW_OUTPUT, merged)
    run_sync_pairs_on_preview()
    print("PASSED")
    print("mode=preview")
    print(f"preview={PREVIEW_OUTPUT}")
    print(f"existing_words={len(existing_words)}")
    print(f"incoming_words={len(entries)}")
    print(f"merged_words={len(merged)}")


if __name__ == "__main__":
    main()
