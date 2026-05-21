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
DEFAULT_IMPORT_SLUG = "official-word-bank"
DEFAULT_BASENAME = "official-word-bank"


def read_arg(name: str, fallback: str = "") -> str:
    if name not in sys.argv:
        return fallback
    index = sys.argv.index(name)
    if index + 1 >= len(sys.argv):
        raise SystemExit(f"{name} needs a value.")
    return sys.argv[index + 1]


def read_source_pdf() -> Path:
    if "--source" in sys.argv:
        return Path(read_arg("--source"))
    positional = [item for item in sys.argv[1:] if not item.startswith("--")]
    if positional:
        return Path(positional[0])
    return DEFAULT_PDF


def build_import_paths() -> dict[str, Path]:
    import_root_text = read_arg("--import-root")
    import_slug = read_arg("--import-slug", DEFAULT_IMPORT_SLUG)
    basename = read_arg("--basename", DEFAULT_BASENAME)
    import_root = Path(import_root_text) if import_root_text else ROOT / "data-imports" / import_slug
    return {
        "import_root": import_root,
        "source_dir": import_root / "source",
        "page_dir": import_root / "extracted-pages",
        "raw_path": import_root / f"{basename}.raw.json",
        "reviewed_path": import_root / f"{basename}.reviewed.json",
        "manifest_path": import_root / "source-manifest.json",
        "report_path": import_root / "import-report.md",
    }


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


def ensure_dirs(source_dir: Path, page_dir: Path) -> None:
    source_dir.mkdir(parents=True, exist_ok=True)
    page_dir.mkdir(parents=True, exist_ok=True)


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


def write_report(source_pdf: Path, pdf_hash: str, pages: list[dict[str, object]], report_path: Path, raw_path: Path, reviewed_path: Path) -> None:
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
        f"The PDF is image-based. Text must be transcribed into `{raw_path.name}`, then reviewed into `{reviewed_path.name}` before any merge.",
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
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    source_pdf = read_source_pdf()
    if not source_pdf.exists():
        raise SystemExit(f"PDF not found: {source_pdf}")
    paths = build_import_paths()
    import_root = paths["import_root"]
    source_dir = paths["source_dir"]
    page_dir = paths["page_dir"]
    raw_path = paths["raw_path"]
    reviewed_path = paths["reviewed_path"]
    manifest_path = paths["manifest_path"]
    report_path = paths["report_path"]
    ensure_dirs(source_dir, page_dir)
    copied_pdf = source_dir / source_pdf.name
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
        image_path = page_dir / f"page-{index:03d}{extension}"
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
            "imagePath": str(image_path.relative_to(import_root)).replace("\\", "/"),
            "filter": filter_name,
            "width": int(width) if width and width.isdigit() else None,
            "height": int(height) if height and height.isdigit() else None,
            "sha256": hashlib.sha256(image_bytes).hexdigest(),
        })
    manifest = {
        "metadata": {
            "kind": "official-word-bank-source-manifest",
            "sourcePdf": str(source_pdf),
            "sourcePdfCopy": str(copied_pdf.relative_to(import_root)).replace("\\", "/"),
            "sourcePdfSha256": pdf_hash,
            "createdAt": utc_now(),
            "pdfType": "image-only",
        },
        "pages": pages,
    }
    write_json(manifest_path, manifest)
    if not raw_path.exists():
        write_json(raw_path, build_empty_raw_manifest(source_pdf, pdf_hash, len(pages)))
    if not reviewed_path.exists():
        write_json(reviewed_path, build_empty_review_manifest(source_pdf, pdf_hash, len(pages)))
    write_report(source_pdf, pdf_hash, pages, report_path, raw_path, reviewed_path)
    print("PASSED")
    print(f"source_pdf={source_pdf}")
    print(f"pages={len(pages)}")
    print(f"import_root={import_root}")
    print(f"manifest={manifest_path}")
    print(f"raw={raw_path}")
    print(f"reviewed={reviewed_path}")


if __name__ == "__main__":
    main()
