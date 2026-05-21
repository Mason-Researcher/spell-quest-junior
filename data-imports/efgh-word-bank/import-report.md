# EFGH Word Bank Import Report

- Source PDF: `C:\Users\hch12\Downloads\英文單字\EFGH-的單字庫.pdf`
- SHA256: `bd7befcb9157bc8b5f481871b9080c2f163659a20246bc08d729ba768e344cec`
- Extracted page images: `12`
- Raw transcribed entries: `605`
- Website candidate entries after source-deduplication: `604`
- Source duplicates skipped from website candidates: `1` (`E187 extensive`, duplicate of `E160 extensive`)
- Generated at: `2026-05-20T16:40:38Z`

## Current Status

The PDF is image-based. Source rows are transcribed into `efgh-word-bank.raw.tsv`, converted into `efgh-word-bank.raw.json`, then moved through the same A-D review queue, reviewed draft, machine candidate, and visual review workbench flow.

## Extracted Pages

- Page 001: `extracted-pages/page-001.jpg` (2001 x 3018, DCTDecode)
- Page 002: `extracted-pages/page-002.jpg` (1620 x 2360, DCTDecode)
- Page 003: `extracted-pages/page-003.jpg` (1947 x 2826, DCTDecode)
- Page 004: `extracted-pages/page-004.jpg` (1946 x 2862, DCTDecode)
- Page 005: `extracted-pages/page-005.jpg` (1716 x 2389, DCTDecode)
- Page 006: `extracted-pages/page-006.jpg` (1688 x 2391, DCTDecode)
- Page 007: `extracted-pages/page-007.jpg` (1799 x 2535, DCTDecode)
- Page 008: `extracted-pages/page-008.jpg` (1809 x 2489, DCTDecode)
- Page 009: `extracted-pages/page-009.jpg` (1817 x 2553, DCTDecode)
- Page 010: `extracted-pages/page-010.jpg` (1855 x 2630, DCTDecode)
- Page 011: `extracted-pages/page-011.jpg` (1833 x 2791, DCTDecode)
- Page 012: `extracted-pages/page-012.jpg` (1879 x 2796, DCTDecode)

## Merge Gate

- Do not merge raw TSV, raw JSON, review queue, or reviewed draft directly.
- Every reviewed entry must include complete website fields.
- Every Traditional Chinese field must include zhuyin and generated bpmf pairs before publication.
- Every added word must pass context, audio, practice, search, and exam validation after approved merge preview.
