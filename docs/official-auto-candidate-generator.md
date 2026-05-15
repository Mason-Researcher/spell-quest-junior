# 官方單字庫自動候選生成器

## 目標

把 851 筆 `needs_review` draft 轉成可檢查的 `machine_candidate`。這份輸出提供例句、中文翻譯、三個情境、注音與逐字注音 pairs，但不會標成 approved。

## 支援 provider

| Provider | 用途 | 是否需要外部服務 |
| --- | --- | --- |
| `template` | 本機 deterministic 生成，保守產出拼字學習情境 | 否 |
| `jsonl` / `llm-jsonl` / `google-jsonl` | 接收 Google、LLM 或其他工具回傳的 JSONL 結果 | 視外部工具而定 |

## 產生本機候選

```powershell
npm run generate:official-auto-candidates
```

輸出：

- `data-imports/official-word-bank/official-word-bank.auto-candidates.json`
- `data-imports/official-word-bank/auto-candidates-report.md`
- `data-imports/official-word-bank/official-word-bank.provider-requests.jsonl`

## 串接 Google / LLM

先產生 provider request：

```powershell
node tools/generate_official_auto_candidates.js --provider template --write-provider-requests
```

外部 provider 必須回傳 JSONL，每行一筆，格式如下：

```json
{"sourceKey":"A001","example":"I never abandon my small plant.","exampleZh":"我不會拋棄我的小植物。","usage":"Use abandon when someone leaves something behind.","contexts":[{"id":"school","labelZh":"學校","sentence":"I do not abandon my team.","sentenceZh":"我不會拋棄我的隊伍。","usageZh":"用 abandon 表示離開或放棄原本該照顧的人事物。","sourceBasis":["provider-semantic-example"]},{"id":"home","labelZh":"家裡","sentence":"We never abandon our pet.","sentenceZh":"我們不會拋棄寵物。","usageZh":"看到放棄照顧時，可以用 abandon。","sourceBasis":["provider-semantic-example"]},{"id":"story","labelZh":"故事","sentence":"The hero will not abandon his friend.","sentenceZh":"英雄不會拋棄他的朋友。","usageZh":"故事裡有人不離開朋友時，可以用 abandon。","sourceBasis":["provider-semantic-example"]}],"score":0.94}
```

再匯入外部 provider 結果：

```powershell
node tools/generate_official_auto_candidates.js --provider llm-jsonl --input data-imports/official-word-bank/provider-output.jsonl
```

## 驗證

```powershell
npm run validate:official-auto-candidates
```

驗證內容：

- 851 筆候選必須完整對應 reviewed draft。
- 不可與正式網站既有 ID 或單字重複。
- 每筆必須維持 `reviewStatus=machine_candidate`。
- 每筆必須有例句、中文翻譯、三個情境、注音、逐字注音 pairs。
- 每個英文例句與情境句必須包含目標單字。
- 英文句子必須維持 5-14 字的國小友善長度。
- 不可出現 TODO、placeholder、teacher-approved sentence is added 等佔位文字。

## 合併政策

`official-word-bank.auto-candidates.json` 不可直接合併到正式網站。只有人工或更高級審核流程把資料轉入 `official-word-bank.reviewed.json`，且 `reviewStatus=approved`，才可進入 merge script。
