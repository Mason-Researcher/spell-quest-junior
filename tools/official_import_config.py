from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os
import sys


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SLUG = "official-word-bank"


def read_arg(name: str, fallback: str = "") -> str:
    if name not in sys.argv:
        return fallback
    index = sys.argv.index(name)
    if index + 1 >= len(sys.argv):
        raise ValueError(f"{name} needs a value.")
    return sys.argv[index + 1]


def value_from_arg_or_env(arg_name: str, env_name: str, fallback: str) -> str:
    return read_arg(arg_name, os.environ.get(env_name, fallback))


@dataclass(frozen=True)
class ImportConfig:
    basename: str
    import_root: Path
    preview_prefix: str
    slug: str

    @property
    def raw_path(self) -> Path:
        return self.import_root / f"{self.basename}.raw.json"

    @property
    def review_queue_path(self) -> Path:
        return self.import_root / f"{self.basename}.review-queue.json"

    @property
    def reviewed_path(self) -> Path:
        return self.import_root / f"{self.basename}.reviewed.json"

    @property
    def reviewed_preview_path(self) -> Path:
        return self.import_root / f"{self.basename}.reviewed.preview.json"

    @property
    def merged_preview_path(self) -> Path:
        return self.import_root / f"words.{self.preview_prefix}-merged.preview.json"

    @property
    def source_manifest_path(self) -> Path:
        return self.import_root / "source-manifest.json"

    @property
    def review_queue_report_path(self) -> Path:
        return self.import_root / "review-queue-report.md"


def get_import_config() -> ImportConfig:
    slug = value_from_arg_or_env("--import-slug", "WORD_BANK_IMPORT_SLUG", DEFAULT_SLUG)
    basename = value_from_arg_or_env("--basename", "WORD_BANK_BASENAME", slug)
    import_root_text = value_from_arg_or_env("--import-root", "WORD_BANK_IMPORT_ROOT", "")
    import_root = (ROOT / import_root_text).resolve() if import_root_text else ROOT / "data-imports" / slug
    preview_prefix = "official" if slug == DEFAULT_SLUG and basename == DEFAULT_SLUG else basename
    return ImportConfig(basename=basename, import_root=import_root, preview_prefix=preview_prefix, slug=slug)
