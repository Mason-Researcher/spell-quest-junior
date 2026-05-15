# 官方單字審核工作台

## 目標

把 `official-word-bank.auto-candidates.json` 的 `machine_candidate` 逐筆視覺化審核，只有通過人工確認的資料才匯出成 `approved`，再由匯入腳本寫入 `official-word-bank.reviewed.json`。

## 本機流程

1. 產生本機工作台資料。

   ```powershell
   npm run prepare:review-workbench
   ```

2. 開啟本機工作台。

   ```text
   http://127.0.0.1:4173/review.html
   ```

3. 逐筆確認欄位。

   - 中文意思與注音
   - 英文例句
   - 中文翻譯與注音
   - 三個國中銜接情境
   - 每個情境的中文翻譯、用法說明與注音

4. 按「核准這筆」後，該筆會標記為 approved。

5. 按「匯出 approved JSON」取得 `official-word-bank.reviewed.json`。

6. 匯入前先跑預覽驗證。

   ```powershell
   npm run import:review-approved -- --input "C:\path\to\official-word-bank.reviewed.json" --min 1
   ```

7. 確認預覽驗證通過後才正式寫入。

   ```powershell
   npm run import:review-approved -- --input "C:\path\to\official-word-bank.reviewed.json" --min 1 --apply
   ```

8. 寫入後跑合併預覽。

   ```powershell
   py tools\merge_official_word_bank.py
   ```

## 防呆規則

- `site/data/review/*.json` 已加入 `.gitignore`，候選資料只供本機工作台使用，不會被提交。
- 工作台只暫存審核進度到瀏覽器 `localStorage`。
- 匯出的資料會被 `validate_official_reviewed_entries.js` 檢查：
  - `reviewStatus` 必須是 `approved`
  - `contentReview.status` 必須是 `approved`
  - 每筆至少三個情境
  - 英文例句與情境句必須包含目標單字
  - 中文欄位必須有注音 pairs
  - 不可撞到既有正式網站單字

## 發布原則

審核工作台可以 commit，但未審核候選 JSON 不可 commit。正式 `words.json` 只有在 `official-word-bank.reviewed.json` 通過驗證與人工確認後才能合併。
