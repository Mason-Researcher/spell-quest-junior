# data/schema.md

## Word Bank

Word banks can be either a plain JSON array or an object with a `words` array.

Required fields for every word:

| Field | Type | Purpose |
|---|---|---|
| `id` | string | Stable unique word id. |
| `word` | string | English spelling answer. |
| `pos` | string | Part of speech. |
| `zh` | string | Traditional Chinese meaning. |
| `zhuyin` | string | Zhuyin for the Chinese meaning. |
| `zhPairs` | object[] | Per-character Taiwan-style zhuyin pairs for `zh`. |
| `source` | string | Source page or source file. |
| `level` | string | One of `starter`, `bridge`, `challenge`. |
| `topic` | string | Machine-readable topic key. |
| `topicZh` | string | Traditional Chinese topic label. |
| `topicZhuyin` | string | Zhuyin for the topic label. |
| `topicZhPairs` | object[] | Per-character Taiwan-style zhuyin pairs for `topicZh`. |
| `starred` | boolean | Whether source sheet marks it as a focus word. |
| `example` | string | English example sentence. |
| `usage` | string | English usage prompt. |

## Approved Context Enrichment

Context enrichment is optional. The app only renders context tabs when the word has approved review metadata, so unreviewed records keep the legacy fallback UI.

| Field | Type | Purpose |
|---|---|---|
| `exampleZh` | string | Traditional Chinese translation of `example`. |
| `exampleZhuyin` | string | Zhuyin for `exampleZh`. |
| `exampleZhPairs` | object[] | Per-character Taiwan-style zhuyin pairs for `exampleZh`. |
| `contentReview.status` | string | Must be `approved` before enriched UI is shown. |
| `contentReview.sourceRefs` | object[] | Learner dictionary references used during review, usually `{ "label": "...", "url": "..." }`. |
| `contexts` | object[] | Junior-high-ready usage contexts. Minimum 3 for approved samples. |

Required fields for each approved context:

| Field | Type | Purpose |
|---|---|---|
| `id` | string | Stable context id for future audio clips and expansion. |
| `level` | string | Intended learner band, currently `junior-high-ready`. |
| `labelZh` | string | Short Traditional Chinese tab label. |
| `labelZhuyin` | string | Zhuyin for the tab label. |
| `labelZhPairs` | object[] | Per-character Taiwan-style zhuyin pairs for the tab label. |
| `sentence` | string | English sentence that must contain the target word. |
| `sentenceZh` | string | Traditional Chinese translation. |
| `sentenceZhuyin` | string | Zhuyin for `sentenceZh`. |
| `sentenceZhPairs` | object[] | Per-character Taiwan-style zhuyin pairs for `sentenceZh`. |
| `usageZh` | string | Chinese usage task. |
| `usageZhuyin` | string | Zhuyin for `usageZh`. |
| `usageZhPairs` | object[] | Per-character Taiwan-style zhuyin pairs for `usageZh`. |
| `sourceBasis` | string[] | The meaning or usage basis used for review. |
| `reviewStatus` | string | Must be `approved` to render in the UI. |

Run this after adding or editing enriched content:

```powershell
node tools\sync_zhuyin_pairs.js
node tools\validate_context_data.js
```

Zhuyin pair format:

```json
[
  { "text": "牛", "bpmf": "ㄋㄧㄡˊ" },
  { "text": "奶", "bpmf": "ㄋㄞˇ" },
  { "text": "。", "bpmf": "" }
]
```

## Audio Manifest

The website plays static MP3 files first. Browser speech is only a fallback.

For context-specific future MP3 expansion, add clip keys using this format:

```json
{
  "clips": {
    "D001": {
      "context-school-routine-en": {
        "path": "assets/audio/generated/D001-context-school-routine-en.mp3",
        "lang": "en-US"
      },
      "context-school-routine-zh": {
        "path": "assets/audio/generated/D001-context-school-routine-zh.mp3",
        "lang": "zh-TW"
      }
    }
  }
}
```
