from __future__ import annotations

from pathlib import Path
import json
import sys

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
IMPORT_ROOT = ROOT / "data-imports" / "official-word-bank"
RAW_PATH = IMPORT_ROOT / "official-word-bank.raw.json"
QUEUE_PATH = IMPORT_ROOT / "official-word-bank.review-queue.json"
SITE_WORDS_PATH = ROOT / "site" / "data" / "words.json"

REQUIRED_COLUMNS = [
    "sourceKey",
    "sourceLetter",
    "sourceNo",
    "word",
    "posRaw",
    "zhRaw",
    "starred",
    "sourcePage",
    "sourceRow",
    "action",
    "existingSiteId",
    "candidate",
    "reviewChecklist",
]

ALLOWED_ACTIONS = {"already-live", "needs-review"}


def read_json(path: Path) -> object:
    if not path.exists():
        raise FileNotFoundError(str(path))
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_word(value: object) -> str:
    return str(value or "").strip().lower()


def source_key(source_letter: object, source_no: object) -> str:
    return f"{str(source_letter)}{int(source_no):03d}"


def get_candidate_id(value: object) -> str:
    if not isinstance(value, dict):
        return ""
    return str(value.get("id") or "")


def get_candidate_status(value: object) -> str:
    if not isinstance(value, dict):
        return ""
    return str(value.get("reviewStatus") or "")


def main() -> None:
    messages: list[str] = []
    allow_site_collisions = "--allow-site-collisions" in sys.argv
    raw_payload = read_json(RAW_PATH)
    queue_payload = read_json(QUEUE_PATH)
    site_words = read_json(SITE_WORDS_PATH)
    raw_entries = raw_payload.get("entries", []) if isinstance(raw_payload, dict) else []
    queue_entries = queue_payload.get("entries", []) if isinstance(queue_payload, dict) else []
    if not isinstance(site_words, list):
        messages.append("site/data/words.json must be a list.")
        site_words = []
    raw_frame = pd.DataFrame(raw_entries)
    queue_frame = pd.DataFrame(queue_entries)
    site_frame = pd.DataFrame(site_words)
    if len(raw_frame) != len(queue_frame):
        messages.append(f"Queue count does not match raw count: {len(queue_frame)} != {len(raw_frame)}")
    missing = [column for column in REQUIRED_COLUMNS if column not in queue_frame.columns]
    if missing:
        messages.append(f"Queue entries missing columns: {missing}")
    if messages:
        print("FAILED")
        for message in messages:
            print(f"- {message}")
        raise SystemExit(1)
    expected_keys = set(raw_frame.apply(lambda row: source_key(row["sourceLetter"], row["sourceNo"]), axis=1).tolist())
    actual_keys = set(queue_frame["sourceKey"].astype(str).tolist())
    if expected_keys != actual_keys:
        messages.append("Queue source keys do not match raw source keys.")
    invalid_actions = sorted(set(queue_frame["action"].astype(str).tolist()) - ALLOWED_ACTIONS)
    if invalid_actions:
        messages.append(f"Invalid queue actions: {invalid_actions}")
    if queue_frame["sourceKey"].duplicated().any():
        duplicates = queue_frame.loc[queue_frame["sourceKey"].duplicated(), "sourceKey"].tolist()
        messages.append(f"Duplicate queue sourceKey: {duplicates[:20]}")
    site_word_map = {
        normalize_word(row.get("word")): row.get("id")
        for row in site_words
        if isinstance(row, dict)
    }
    queue_frame["expectedExistingId"] = queue_frame["word"].map(lambda word: site_word_map.get(normalize_word(word)))
    already_live = queue_frame[queue_frame["action"] == "already-live"].copy()
    needs_review = queue_frame[queue_frame["action"] == "needs-review"].copy()
    needs_review["candidateId"] = needs_review["candidate"].map(get_candidate_id)
    missing_existing = already_live.loc[already_live["expectedExistingId"].isna(), "sourceKey"].tolist()
    if missing_existing:
        messages.append(f"already-live entries without matching site word: {missing_existing[:20]}")
    wrongly_existing = needs_review.loc[needs_review["expectedExistingId"].notna(), "sourceKey"].tolist()
    if wrongly_existing and not allow_site_collisions:
        messages.append(f"needs-review entries already exist in site words: {wrongly_existing[:20]}")
    if wrongly_existing and allow_site_collisions:
        wrong_post_merge = needs_review.loc[
            needs_review["expectedExistingId"].notna()
            & (needs_review["candidateId"].astype(str) != needs_review["expectedExistingId"].astype(str)),
            "sourceKey",
        ].tolist()
        if wrong_post_merge:
            messages.append(f"post-merge needs-review entries collide with different site ids: {wrong_post_merge[:20]}")
    already_live_bad_id = already_live.loc[
        already_live["existingSiteId"].astype(str) != already_live["expectedExistingId"].astype(str),
        "sourceKey",
    ].tolist()
    if already_live_bad_id:
        messages.append(f"already-live entries have wrong existingSiteId: {already_live_bad_id[:20]}")
    site_ids = set(site_frame["id"].astype(str).tolist()) if "id" in site_frame.columns else set()
    duplicate_candidate_ids = needs_review.loc[needs_review["candidateId"].duplicated(), "candidateId"].tolist()
    if duplicate_candidate_ids:
        messages.append(f"Duplicate needs-review candidate ids: {duplicate_candidate_ids[:20]}")
    candidate_site_id_collisions = sorted(set(needs_review["candidateId"].tolist()) & site_ids)
    if candidate_site_id_collisions and not allow_site_collisions:
        messages.append(f"Needs-review candidate ids collide with site ids: {candidate_site_id_collisions[:20]}")
    needs_review["candidateStatus"] = needs_review["candidate"].map(get_candidate_status)
    bad_status = needs_review.loc[needs_review["candidateStatus"] != "needs_review", "sourceKey"].tolist()
    if bad_status:
        messages.append(f"Needs-review entries have wrong candidate reviewStatus: {bad_status[:20]}")
    if messages:
        print("FAILED")
        for message in messages:
            print(f"- {message}")
        raise SystemExit(1)
    print("PASSED")
    print(f"raw_entries={len(raw_frame)}")
    print(f"queue_entries={len(queue_frame)}")
    print(f"already_live={len(already_live)}")
    print(f"needs_review={len(needs_review)}")


if __name__ == "__main__":
    main()
