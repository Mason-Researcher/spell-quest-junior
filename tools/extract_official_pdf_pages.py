from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import shutil
import sys


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF = Path(r"C:\Users\hch12\Downloads\英文單字\單字庫.pdf")
IMPORT_ROOT = ROOT / "data-imports" / "official-word-bank"
SOURCE_DIR = IMPORT_ROOT / "source"
PAGE_DIR = IMPORT_ROOT / "extracted-pages"
RAW_PATH = IMPORT_ROOT / "official-word-bank.raw.json"
REVIEWED_PATH = IMPORT_ROOT / "official-word-bank.reviewed.json"
MANIFEST_PATH = IMPORT_ROOT / "source-manifest.json"
REPORT_PATH = IMPORT_ROOT / "import-report.md"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        while True:
            chunk = file.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def ensure_dirs() -> None:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    PAGE_DIR.mkdir(parents=True, exist_ok=True)


def find_marker(data: bytes, marker: bytes, start: int) -> int:
    return data.find(marker, start)


def parse_pdf_image_streams(data: bytes) -> list[dict[str, object]]:
    images: list[dict[str, object]] = []
    cursor = 0
    while True:
        subtype_at = find_marker(data, b"/Subtype /Image", cursor)
        if subtype_at < 0:
            break
        header_start = data.rfind(b"<<", 0, subtype_at)
        stream_at = find_marker(data, b"stream", subtype_at)
        endstream_at = find_marker(data, b"endstream", stream_at)
        if header_start < 0 or stream_at < 0 or endstream_at < 0:
            cursor = subtype_at + len(b"/Subtype /Image")
            continue
        header = data[header_start:stream_at]
        stream_start = stream_at + len(b"stream")
        if data[stream_start:stream_start + 2] == b"\r\n":
            stream_start += 2
        elif data[stream_start:stream_start + 1] in [b"\n", b"\r"]:
            stream_start += 1
        stream_end = endstream_at
        while stream_end > stream_start and data[stream_end - 1:stream_end] in [b"\n", b"\r"]:
            stream_end -= 1
        image_bytes = data[stream_start:stream_end]
        filter_name = "unknown"
        if b"/DCTDecode" in header:
            filter_name = "DCTDecode"
        elif b"/JPXDecode" in header:
            filter_name = "JPXDecode"
        images.append({
            "header": header.decode("latin1", errors="replace"),
            "filter": filter_name,
            "bytes": image_bytes,
        })
        cursor = endstream_at + len(b"endstream")
    return images


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_empty_raw_manifest(source_pdf: Path, pdf_hash: str, page_count: int) -> dict[str, object]:
    return {
        "metadata": {
            "kind": "official-word-bank-raw",
            "status": "needs-transcription",
            "sourcePdf": str(source_pdf),
            "sourcePdfSha256": pdf_hash,
            "pageCount": page_count,
            "createdAt": utc_now(),
            "note": "Entries must be transcribed and reviewed before merge.",
        },
        "entries": [],
    }


def build_empty_review_manifest(source_pdf: Path, pdf_hash: str, page_count: int) -> dict[str, object]:
    return {
        "metadata": {
            "kind": "official-word-bank-reviewed",
            "status": "empty",
            "sourcePdf": str(source_pdf),
            "sourcePdfSha256": pdf_hash,
            "pageCount": page_count,
            "createdAt": utc_now(),
            "mergePolicy": "Only entries with reviewStatus=approved and complete website fields may be merged.",
        },
        "entries": [],
    }


def write_report(source_pdf: Path, pdf_hash: str, pages: list[dict[str, object]]) -> None:
    lines = [
        "# Official Word Bank Import Report",
        "",
        f"- Source PDF: `{source_pdf}`",
        f"- SHA256: `{pdf_hash}`",
        f"- Extracted page images: `{len(pages)}`",
        f"- Generated at: `{utc_now()}`",
        "",
        "## Current Status",
        "",
        "The PDF is image-based. Text must be transcribed into `official-word-bank.raw.json`, then reviewed into `official-word-bank.reviewed.json` before any merge.",
        "",
        "## Extracted Pages",
        "",
    ]
    for page in pages:
        lines.append(f"- Page {page['page']:03d}: `{page['imagePath']}` ({page['width']} x {page['height']}, {page['filter']})")
    lines += [
        "",
        "## Merge Gate",
        "",
        "- Do not merge raw OCR/transcription output directly.",
        "- Every reviewed entry must include complete website fields.",
        "- Every Traditional Chinese field must include zhuyin and generated bpmf pairs before publication.",
    ]
    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    source_pdf = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PDF
    if not source_pdf.exists():
        raise SystemExit(f"PDF not found: {source_pdf}")
    ensure_dirs()
    copied_pdf = SOURCE_DIR / source_pdf.name
    if source_pdf.resolve() != copied_pdf.resolve():
        shutil.copy2(source_pdf, copied_pdf)
    data = source_pdf.read_bytes()
    pdf_hash = sha256_file(source_pdf)
    images = parse_pdf_image_streams(data)
    pages: list[dict[str, object]] = []
    for index, image in enumerate(images, start=1):
        image_bytes = image["bytes"]
        filter_name = str(image["filter"])
        extension = ".jpg" if filter_name == "DCTDecode" else ".bin"
        image_path = PAGE_DIR / f"page-{index:03d}{extension}"
        image_path.write_bytes(image_bytes)
        width = None
        height = None
        header = str(image["header"])
        words = header.replace("[", " ").replace("]", " ").replace("\n", " ").split()
        for pos, word in enumerate(words):
            if word == "/Width" and pos + 1 < len(words):
                width = words[pos + 1]
            if word == "/Height" and pos + 1 < len(words):
                height = words[pos + 1]
        pages.append({
            "page": index,
            "imagePath": str(image_path.relative_to(IMPORT_ROOT)).replace("\\", "/"),
            "filter": filter_name,
            "width": int(width) if width and width.isdigit() else None,
            "height": int(height) if height and height.isdigit() else None,
            "sha256": hashlib.sha256(image_bytes).hexdigest(),
        })
    manifest = {
        "metadata": {
            "kind": "official-word-bank-source-manifest",
            "sourcePdf": str(source_pdf),
            "sourcePdfCopy": str(copied_pdf.relative_to(IMPORT_ROOT)).replace("\\", "/"),
            "sourcePdfSha256": pdf_hash,
            "createdAt": utc_now(),
            "pdfType": "image-only",
        },
        "pages": pages,
    }
    write_json(MANIFEST_PATH, manifest)
    if not RAW_PATH.exists():
        write_json(RAW_PATH, build_empty_raw_manifest(source_pdf, pdf_hash, len(pages)))
    if not REVIEWED_PATH.exists():
        write_json(REVIEWED_PATH, build_empty_review_manifest(source_pdf, pdf_hash, len(pages)))
    write_report(source_pdf, pdf_hash, pages)
    print("PASSED")
    print(f"source_pdf={source_pdf}")
    print(f"pages={len(pages)}")
    print(f"manifest={MANIFEST_PATH}")
    print(f"raw={RAW_PATH}")
    print(f"reviewed={REVIEWED_PATH}")


if __name__ == "__main__":
    main()
