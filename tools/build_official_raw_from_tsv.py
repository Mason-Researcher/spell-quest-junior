from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import json
import sys

import pandas as pd

from official_import_config import get_import_config


IMPORT_CONFIG = get_import_config()

REQUIRED_COLUMNS = [
    "sourceLetter",
    "sourceNo",
    "word",
    "pos",
    "zhRaw",
    "starred",
    "sourcePage",
    "sourceRow",
]


def read_text_flag(flag: str, fallback: str) -> str:
    if flag not in sys.argv:
        return fallback
    position = sys.argv.index(flag)
    if position + 1 >= len(sys.argv):
        raise ValueError(f"{flag} needs a value.")
    return str(sys.argv[position + 1])


def normalize_text(value: object) -> str:
    return str(value or "").strip()


def normalize_bool(value: object) -> bool:
    text = normalize_text(value).lower()
    return text in {"1", "true", "yes", "y", "star", "starred", "星號", "*"}


def normalize_int(value: object, column: str) -> int:
    text = normalize_text(value)
    if not text.isdigit():
        raise ValueError(f"{column} must be a positive integer: {text}")
    return int(text)


def build_entries(frame: pd.DataFrame) -> list[dict[str, object]]:
    entries: list[dict[str, object]] = []
    for index, row in frame.iterrows():
        source_letter = normalize_text(row["sourceLetter"]).upper()
        source_no = normalize_int(row["sourceNo"], f"sourceNo row {index + 2}")
        entry = {
            "sourceLetter": source_letter,
            "sourceNo": source_no,
            "word": normalize_text(row["word"]),
            "pos": normalize_text(row["pos"]),
            "zhRaw": normalize_text(row["zhRaw"]),
            "starred": normalize_bool(row["starred"]),
            "sourcePage": normalize_int(row["sourcePage"], f"sourcePage row {index + 2}"),
            "sourceRow": normalize_int(row["sourceRow"], f"sourceRow row {index + 2}"),
            "reviewStatus": normalize_text(row.get("reviewStatus", "transcribed")) or "transcribed",
        }
        entries.append(entry)
    return entries


def validate_table(frame: pd.DataFrame) -> list[str]:
    messages: list[str] = []
    missing = [column for column in REQUIRED_COLUMNS if column not in frame.columns]
    if missing:
        messages.append(f"Missing TSV columns: {missing}")
        return messages
    empty_required = frame.loc[
        frame[REQUIRED_COLUMNS].apply(lambda row: any(normalize_text(value) == "" for value in row), axis=1)
    ]
    if len(empty_required) > 0:
        row_numbers = [int(index) + 2 for index in empty_required.index.tolist()]
        messages.append(f"Rows with empty required values: {row_numbers[:20]}")
    return messages


def main() -> None:
    input_path = Path(read_text_flag("--input", str(IMPORT_CONFIG.import_root / f"{IMPORT_CONFIG.basename}.raw.tsv")))
    output_path = Path(read_text_flag("--output", str(IMPORT_CONFIG.raw_path)))
    if not input_path.exists():
        raise FileNotFoundError(str(input_path))
    frame = pd.read_csv(input_path, sep="\t", dtype=str, keep_default_na=False)
    messages = validate_table(frame)
    if messages:
        print("FAILED")
        for message in messages:
            print(f"- {message}")
        raise SystemExit(1)
    entries = build_entries(frame)
    payload = {
        "metadata": {
            "kind": "official-word-bank-raw",
            "status": "transcribed",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "sourceTsv": str(input_path),
            "entryCount": len(entries),
            "importSlug": IMPORT_CONFIG.slug,
            "basename": IMPORT_CONFIG.basename,
        },
        "entries": entries,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("PASSED")
    print(f"input={input_path}")
    print(f"output={output_path}")
    print(f"entries={len(entries)}")


if __name__ == "__main__":
    main()
