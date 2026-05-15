from __future__ import annotations

from pathlib import Path
import json
import sys

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
IMPORT_ROOT = ROOT / "data-imports" / "official-word-bank"
MANIFEST_PATH = IMPORT_ROOT / "source-manifest.json"
RAW_PATH = IMPORT_ROOT / "official-word-bank.raw.json"
REVIEWED_PATH = IMPORT_ROOT / "official-word-bank.reviewed.json"
SITE_WORDS_PATH = ROOT / "site" / "data" / "words.json"

RAW_COLUMNS = [
    "sourceLetter",
    "sourceNo",
    "word",
    "pos",
    "zhRaw",
    "starred",
    "sourcePage",
    "sourceRow",
    "reviewStatus",
]

SITE_COLUMNS = [
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

ALLOWED_LEVELS = {"starter", "bridge", "challenge"}


def read_json(path: Path) -> object:
    if not path.exists():
        raise FileNotFoundError(str(path))
    return json.loads(path.read_text(encoding="utf-8"))


def is_alpha_word(value: object) -> bool:
    text = str(value or "").replace(" ", "").replace("-", "")
    return bool(text) and text.isalpha()


def starts_with_expected_initial(value: object) -> bool:
    text = str(value or "").strip()
    if not text:
        return False
    first = text[0].upper()
    return first >= "A" and first <= "Z"


def has_cjk(value: object) -> bool:
    for char in str(value or ""):
        code = ord(char)
        if (0x3400 <= code <= 0x4DBF) or (0x4E00 <= code <= 0x9FFF) or (0xF900 <= code <= 0xFAFF):
            return True
    return False


def validate_manifest(messages: list[str]) -> int:
    manifest = read_json(MANIFEST_PATH)
    pages = manifest.get("pages", []) if isinstance(manifest, dict) else []
    if not pages:
        messages.append("source-manifest.json has no pages.")
        return 0
    page_numbers = [page.get("page") for page in pages]
    if page_numbers != list(range(1, len(page_numbers) + 1)):
        messages.append("Page numbers are not continuous from 1.")
    for page in pages:
        image_path = IMPORT_ROOT / str(page.get("imagePath", ""))
        if not image_path.exists():
            messages.append(f"Missing extracted image: {image_path}")
        if page.get("filter") != "DCTDecode":
            messages.append(f"Unexpected page image filter on page {page.get('page')}: {page.get('filter')}")
    return len(pages)


def validate_raw(messages: list[str]) -> int:
    raw = read_json(RAW_PATH)
    entries = raw.get("entries", []) if isinstance(raw, dict) else []
    if not entries:
        return 0
    frame = pd.DataFrame(entries)
    missing = [column for column in RAW_COLUMNS if column not in frame.columns]
    if missing:
        messages.append(f"Raw entries missing columns: {missing}")
        return len(frame)
    frame["sourceKey"] = frame["sourceLetter"].astype(str) + frame["sourceNo"].astype(str)
    if frame["sourceKey"].duplicated().any():
        duplicates = frame.loc[frame["sourceKey"].duplicated(), "sourceKey"].tolist()
        messages.append(f"Raw duplicate sourceKey: {duplicates}")
    for source_letter, group in frame.groupby("sourceLetter"):
        source_numbers = sorted([int(value) for value in group["sourceNo"].tolist()])
        expected_numbers = list(range(source_numbers[0], source_numbers[-1] + 1))
        if source_numbers != expected_numbers:
            missing_numbers = sorted(set(expected_numbers) - set(source_numbers))
            messages.append(f"Raw sourceNo is not continuous for {source_letter}. Missing: {missing_numbers[:20]}")
    if frame["word"].str.lower().duplicated().any():
        duplicates = frame.loc[frame["word"].str.lower().duplicated(), "word"].tolist()
        messages.append(f"Raw duplicate words: {duplicates}")
    bad_words = frame.loc[~frame["word"].map(is_alpha_word), "word"].tolist()
    if bad_words:
        messages.append(f"Raw unsupported word spelling: {bad_words[:20]}")
    no_cjk = frame.loc[~frame["zhRaw"].map(has_cjk), "word"].tolist()
    if no_cjk:
        messages.append(f"Raw entries without CJK zhRaw: {no_cjk[:20]}")
    return len(frame)


def validate_minimum(label: str, count: int, minimum: int, messages: list[str]) -> None:
    if minimum > 0 and count < minimum:
        messages.append(f"{label} count is below minimum: {count} < {minimum}")


def read_int_flag(flag: str) -> int:
    if flag not in sys.argv:
        return 0
    position = sys.argv.index(flag)
    if position + 1 >= len(sys.argv):
        raise ValueError(f"{flag} needs a number.")
    value = sys.argv[position + 1]
    if not value.isdigit():
        raise ValueError(f"{flag} needs a positive integer.")
    return int(value)


def validate_reviewed(messages: list[str]) -> int:
    reviewed = read_json(REVIEWED_PATH)
    entries = reviewed.get("entries", []) if isinstance(reviewed, dict) else []
    if not entries:
        return 0
    frame = pd.DataFrame(entries)
    missing = [column for column in SITE_COLUMNS if column not in frame.columns]
    if missing:
        messages.append(f"Reviewed entries missing columns: {missing}")
        return len(frame)
    site_words = pd.DataFrame(json.loads(SITE_WORDS_PATH.read_text(encoding="utf-8")))
    allow_site_collisions = "--allow-site-collisions" in sys.argv
    existing_words = set(site_words["word"].str.lower().tolist())
    incoming_words = frame["word"].str.lower()
    duplicates = sorted(set(incoming_words.tolist()) & existing_words)
    if duplicates and not allow_site_collisions:
        messages.append(f"Reviewed entries duplicate existing site words: {duplicates[:20]}")
    if duplicates and allow_site_collisions:
        site_lookup = site_words[["id", "word"]].copy()
        site_lookup["word_lower"] = site_lookup["word"].astype(str).str.lower()
        incoming_lookup = frame[["id", "word"]].copy()
        incoming_lookup["word_lower"] = incoming_lookup["word"].astype(str).str.lower()
        merged_lookup = incoming_lookup.merge(site_lookup, on="id", suffixes=("_incoming", "_site"), how="inner")
        mismatched = merged_lookup.loc[
            merged_lookup["word_lower_incoming"] != merged_lookup["word_lower_site"],
            "id",
        ].tolist()
        if mismatched:
            messages.append(f"Reviewed/site id collisions with different words: {mismatched[:20]}")
    duplicate_ids = frame.loc[frame["id"].duplicated(), "id"].tolist()
    if duplicate_ids:
        messages.append(f"Reviewed duplicate ids: {duplicate_ids[:20]}")
    invalid_levels = sorted(set(frame["level"].tolist()) - ALLOWED_LEVELS)
    if invalid_levels:
        messages.append(f"Reviewed invalid levels: {invalid_levels}")
    bad_words = frame.loc[~frame["word"].map(is_alpha_word), "word"].tolist()
    if bad_words:
        messages.append(f"Reviewed unsupported word spelling: {bad_words[:20]}")
    missing_review = frame.loc[frame["reviewStatus"] != "approved", "word"].tolist()
    if missing_review:
        messages.append(f"Reviewed entries not approved: {missing_review[:20]}")
    for column in ["zh", "zhuyin", "topicZh", "topicZhuyin", "example", "usage"]:
        empty = frame.loc[frame[column].astype(str).str.strip() == "", "word"].tolist()
        if empty:
            messages.append(f"Reviewed empty {column}: {empty[:20]}")
    return len(frame)


def main() -> None:
    messages: list[str] = []
    try:
        min_raw = read_int_flag("--min-raw")
        min_reviewed = read_int_flag("--min-reviewed")
        page_count = validate_manifest(messages)
        raw_count = validate_raw(messages)
        reviewed_count = validate_reviewed(messages)
        if "--require-raw" in sys.argv and raw_count == 0:
            messages.append("Raw entries are required but official-word-bank.raw.json is empty.")
        if "--require-reviewed" in sys.argv and reviewed_count == 0:
            messages.append("Reviewed entries are required but official-word-bank.reviewed.json is empty.")
        validate_minimum("Raw entries", raw_count, min_raw, messages)
        validate_minimum("Reviewed entries", reviewed_count, min_reviewed, messages)
    except Exception as error:
        messages.append(str(error))
        page_count = 0
        raw_count = 0
        reviewed_count = 0
    if messages:
        print("FAILED")
        for message in messages:
            print(f"- {message}")
        raise SystemExit(1)
    print("PASSED")
    print(f"pages={page_count}")
    print(f"raw_entries={raw_count}")
    print(f"reviewed_entries={reviewed_count}")


if __name__ == "__main__":
    main()
