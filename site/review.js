(function () {
  "use strict";

  const CANDIDATE_URL = "data/review/official-word-bank.auto-candidates.json";
  const STORAGE_KEY = "spellQuestOfficialReviewWorkbench:v1";
  const EXPORT_FILE_NAME = "official-word-bank.reviewed.json";
  const FORBIDDEN_TEXT = [
    "todo",
    "tbd",
    "placeholder",
    "teacher-approved sentence is added",
    "until a teacher",
    "needs_review",
    "machine_candidate"
  ];
  const EDITABLE_FIELDS = [
    "zh",
    "zhuyin",
    "topicZh",
    "topicZhuyin",
    "example",
    "exampleZh",
    "exampleZhuyin",
    "usage"
  ];
  const EDITABLE_CONTEXT_FIELDS = [
    "labelZh",
    "labelZhuyin",
    "sentence",
    "sentenceZh",
    "sentenceZhuyin",
    "usageZhuyin",
    "usageZh"
  ];

  const state = {
    entries: [],
    entryById: new Map(),
    progress: createEmptyProgress(),
    visibleIds: [],
    activeId: ""
  };

  const els = {};

  function createEmptyProgress() {
    return {
      version: 1,
      activeId: "",
      approved: {},
      rejected: {},
      edits: {},
      updatedAt: ""
    };
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isWhitespace(char) {
    return char === " " || char === "\n" || char === "\r" || char === "\t";
  }

  function trimText(value) {
    return String(value === undefined || value === null ? "" : value).trim();
  }

  function isCjkCharacter(char) {
    const code = char.charCodeAt(0);
    return (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0xf900 && code <= 0xfaff);
  }

  function isBopomofoCharacter(char) {
    const code = char.charCodeAt(0);
    return (code >= 0x3100 && code <= 0x312f) ||
      char === "ˊ" ||
      char === "ˇ" ||
      char === "ˋ" ||
      char === "˙";
  }

  function hasChinese(text) {
    for (const char of String(text || "")) {
      if (isCjkCharacter(char)) {
        return true;
      }
    }
    return false;
  }

  function hasBopomofo(text) {
    for (const char of String(text || "")) {
      if (isBopomofoCharacter(char)) {
        return true;
      }
    }
    return false;
  }

  function splitTokens(value) {
    const tokens = [];
    let current = "";
    for (const char of String(value || "")) {
      if (isWhitespace(char)) {
        if (current) {
          tokens.push(current);
          current = "";
        }
      } else {
        current += char;
      }
    }
    if (current) {
      tokens.push(current);
    }
    return tokens;
  }

  function countWords(sentence) {
    let count = 0;
    let inWord = false;
    for (const char of String(sentence || "")) {
      if (isWhitespace(char)) {
        if (inWord) {
          count += 1;
          inWord = false;
        }
      } else {
        inWord = true;
      }
    }
    if (inWord) {
      count += 1;
    }
    return count;
  }

  function normalizeWord(value) {
    return trimText(value).toLowerCase();
  }

  function containsForbiddenText(value) {
    const text = trimText(value).toLowerCase();
    for (const forbidden of FORBIDDEN_TEXT) {
      if (text.includes(forbidden)) {
        return true;
      }
    }
    return false;
  }

  function appendUnique(list, value) {
    const output = Array.isArray(list) ? list.slice() : [];
    if (!output.includes(value)) {
      output.push(value);
    }
    return output;
  }

  function textFromPairs(pairs) {
    let output = "";
    if (!Array.isArray(pairs)) {
      return output;
    }
    for (const pair of pairs) {
      output += String(pair.text || "");
    }
    return output;
  }

  function buildPairs(text, zhuyin, owner, errors) {
    const tokens = splitTokens(zhuyin);
    const pairs = [];
    let tokenIndex = 0;
    for (const char of String(text || "")) {
      if (isCjkCharacter(char)) {
        const token = tokens[tokenIndex] || "";
        if (!token) {
          errors.push(`${owner} 的注音數量不足，請補齊每個國字右側注音。`);
        }
        pairs.push({ text: char, bpmf: token });
        tokenIndex += 1;
      } else {
        pairs.push({ text: char, bpmf: "" });
      }
    }
    if (tokenIndex < tokens.length) {
      errors.push(`${owner} 的注音數量多於國字數，請刪除多餘注音。`);
    }
    return pairs;
  }

  function setText(id, value) {
    const element = els[id] || document.getElementById(id);
    if (element) {
      element.textContent = String(value);
    }
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) {
      element.className = className;
    }
    if (text !== undefined) {
      element.textContent = text;
    }
    return element;
  }

  function createButton(className, text, id) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = text;
    if (id) {
      button.dataset.id = id;
    }
    return button;
  }

  function createField(labelText, field, value, multiline) {
    const wrapper = createElement("div", "field");
    const label = document.createElement("label");
    const input = multiline ? document.createElement("textarea") : document.createElement("input");
    input.value = trimText(value);
    input.dataset.field = field;
    if (!multiline) {
      input.type = "text";
    }
    label.append(labelText, input);
    wrapper.appendChild(label);
    return wrapper;
  }

  function createContextField(labelText, index, field, value, multiline) {
    const wrapper = createElement("div", "field");
    const label = document.createElement("label");
    const input = multiline ? document.createElement("textarea") : document.createElement("input");
    input.value = trimText(value);
    input.dataset.contextIndex = String(index);
    input.dataset.contextField = field;
    if (!multiline) {
      input.type = "text";
    }
    label.append(labelText, input);
    wrapper.appendChild(label);
    return wrapper;
  }

  function formatStatus(status) {
    if (status === "approved") {
      return "已核准";
    }
    if (status === "rejected") {
      return "退回";
    }
    return "待審";
  }

  function getStatus(id) {
    if (state.progress.approved[id]) {
      return "approved";
    }
    if (state.progress.rejected[id]) {
      return "rejected";
    }
    return "pending";
  }

  function applyEditableSnapshot(entry, snapshot) {
    if (!snapshot) {
      return entry;
    }
    for (const field of EDITABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(snapshot, field)) {
        entry[field] = snapshot[field];
      }
    }
    if (Array.isArray(snapshot.contexts) && Array.isArray(entry.contexts)) {
      for (let index = 0; index < entry.contexts.length; index += 1) {
        const contextSnapshot = snapshot.contexts[index];
        if (!contextSnapshot) {
          continue;
        }
        for (const field of EDITABLE_CONTEXT_FIELDS) {
          if (Object.prototype.hasOwnProperty.call(contextSnapshot, field)) {
            entry.contexts[index][field] = contextSnapshot[field];
          }
        }
      }
    }
    return entry;
  }

  function getWorkingEntry(id) {
    const source = state.entryById.get(id);
    if (!source) {
      return null;
    }
    const entry = deepClone(source);
    return applyEditableSnapshot(entry, state.progress.edits[id]);
  }

  function collectEditableSnapshot(entry) {
    const snapshot = {};
    for (const field of EDITABLE_FIELDS) {
      snapshot[field] = trimText(entry[field]);
    }
    snapshot.contexts = [];
    if (Array.isArray(entry.contexts)) {
      for (const context of entry.contexts) {
        const contextSnapshot = {};
        for (const field of EDITABLE_CONTEXT_FIELDS) {
          contextSnapshot[field] = trimText(context[field]);
        }
        snapshot.contexts.push(contextSnapshot);
      }
    }
    return snapshot;
  }

  function snapshotsEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function saveEditableSnapshot(id, entry) {
    const source = state.entryById.get(id);
    if (!source) {
      return;
    }
    const sourceSnapshot = collectEditableSnapshot(source);
    const entrySnapshot = collectEditableSnapshot(entry);
    if (snapshotsEqual(sourceSnapshot, entrySnapshot)) {
      delete state.progress.edits[id];
    } else {
      state.progress.edits[id] = entrySnapshot;
    }
  }

  function collectEntryFromForm() {
    if (!state.activeId) {
      return null;
    }
    const entry = getWorkingEntry(state.activeId);
    if (!entry) {
      return null;
    }
    const fieldControls = document.querySelectorAll("[data-field]");
    for (const control of fieldControls) {
      entry[control.dataset.field] = trimText(control.value);
    }
    const contextControls = document.querySelectorAll("[data-context-field]");
    for (const control of contextControls) {
      const index = Number(control.dataset.contextIndex);
      const field = control.dataset.contextField;
      if (Array.isArray(entry.contexts) && entry.contexts[index]) {
        entry.contexts[index][field] = trimText(control.value);
      }
    }
    return entry;
  }

  function markActiveEdited() {
    const entry = collectEntryFromForm();
    if (!entry) {
      return;
    }
    saveEditableSnapshot(state.activeId, entry);
    delete state.progress.approved[state.activeId];
    delete state.progress.rejected[state.activeId];
    state.progress.updatedAt = new Date().toISOString();
    saveProgress();
    updateSummary();
    renderList();
    renderValidation([]);
  }

  function saveProgress() {
    state.progress.activeId = state.activeId;
    state.progress.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
  }

  function loadProgress() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return createEmptyProgress();
      }
      const parsed = JSON.parse(stored);
      return {
        ...createEmptyProgress(),
        ...parsed,
        approved: parsed.approved || {},
        rejected: parsed.rejected || {},
        edits: parsed.edits || {}
      };
    } catch (error) {
      console.warn("Cannot load review progress.", error);
      return createEmptyProgress();
    }
  }

  function fillLetterFilter() {
    const letters = new Set();
    for (const entry of state.entries) {
      letters.add(String(entry.sourceLetter || "").toUpperCase());
    }
    els.letterFilter.textContent = "";
    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "全部字頭";
    els.letterFilter.appendChild(allOption);
    for (const letter of Array.from(letters).sort()) {
      const option = document.createElement("option");
      option.value = letter;
      option.textContent = `${letter} 字頭`;
      els.letterFilter.appendChild(option);
    }
  }

  function matchesSearch(entry, searchText) {
    if (!searchText) {
      return true;
    }
    const target = [
      entry.word,
      entry.zh,
      entry.topicZh,
      entry.example,
      entry.exampleZh,
      entry.sourceKey
    ].join(" ").toLowerCase();
    return target.includes(searchText.toLowerCase());
  }

  function rebuildVisibleIds() {
    const letter = els.letterFilter.value || "all";
    const status = els.statusFilter.value || "pending";
    const searchText = trimText(els.searchInput.value);
    state.visibleIds = [];
    for (const entry of state.entries) {
      const entryStatus = getStatus(entry.id);
      if (letter !== "all" && String(entry.sourceLetter || "").toUpperCase() !== letter) {
        continue;
      }
      if (status !== "all" && entryStatus !== status) {
        continue;
      }
      if (!matchesSearch(getWorkingEntry(entry.id) || entry, searchText)) {
        continue;
      }
      state.visibleIds.push(entry.id);
    }
  }

  function renderSummary() {
    let approved = 0;
    let rejected = 0;
    for (const entry of state.entries) {
      const status = getStatus(entry.id);
      if (status === "approved") {
        approved += 1;
      }
      if (status === "rejected") {
        rejected += 1;
      }
    }
    const total = state.entries.length;
    setText("totalCount", total);
    setText("approvedCount", approved);
    setText("rejectedCount", rejected);
    setText("pendingCount", total - approved - rejected);
  }

  function updateSummary() {
    renderSummary();
    setText("visibleCount", state.visibleIds.length);
  }

  function renderList() {
    els.candidateList.textContent = "";
    for (const id of state.visibleIds) {
      const entry = getWorkingEntry(id);
      if (!entry) {
        continue;
      }
      const status = getStatus(id);
      const button = createButton(`candidate-item ${id === state.activeId ? "is-active" : ""}`, "", id);
      button.dataset.testid = `candidate-${id}`;
      const textWrap = createElement("span", "");
      const word = createElement("strong", "candidate-word", entry.word);
      const meta = createElement("span", "candidate-meta", `${entry.sourceKey} · ${entry.zh} · ${entry.topicZh}`);
      const badge = createElement("span", `status-badge status-${status}`, formatStatus(status));
      textWrap.append(word, meta);
      button.append(textWrap, badge);
      button.addEventListener("click", function () {
        state.activeId = id;
        saveProgress();
        renderAll(true);
      });
      els.candidateList.appendChild(button);
    }
  }

  function renderRecord() {
    els.recordPanel.textContent = "";
    if (!state.activeId) {
      els.recordPanel.appendChild(createElement("p", "load-status", "沒有符合篩選條件的候選資料。"));
      return;
    }
    const entry = getWorkingEntry(state.activeId);
    if (!entry) {
      els.recordPanel.appendChild(createElement("p", "load-status", "找不到目前候選資料。"));
      return;
    }
    const card = createElement("article", "record-card");
    const heading = createElement("div", "record-heading");
    const headingText = createElement("div", "");
    const sourcePill = createElement("span", "source-pill", `${entry.sourceKey} · ${entry.source}`);
    const title = createElement("h2", "", entry.word);
    const meta = createElement("p", "", `${entry.pos} · ${entry.level} · ${formatStatus(getStatus(entry.id))}`);
    headingText.append(sourcePill, title, meta);
    const sourceInfo = createElement("p", "", `原始中文：${entry.zhAlternatives && entry.zhAlternatives.length ? entry.zhAlternatives.join("、") : entry.zh}`);
    heading.append(headingText, sourceInfo);
    const fields = createElement("div", "field-grid");
    fields.appendChild(createElement("h3", "section-title", "核心欄位"));
    fields.appendChild(createField("中文意思", "zh", entry.zh, false));
    fields.appendChild(createField("中文意思注音", "zhuyin", entry.zhuyin, false));
    fields.appendChild(createField("情境分類", "topicZh", entry.topicZh, false));
    fields.appendChild(createField("情境分類注音", "topicZhuyin", entry.topicZhuyin, false));
    const exampleField = createField("英文例句", "example", entry.example, true);
    exampleField.classList.add("full");
    fields.appendChild(exampleField);
    const translationField = createField("中文翻譯", "exampleZh", entry.exampleZh, true);
    translationField.classList.add("full");
    fields.appendChild(translationField);
    const translationZhuyinField = createField("中文翻譯注音", "exampleZhuyin", entry.exampleZhuyin, true);
    translationZhuyinField.classList.add("full");
    fields.appendChild(translationZhuyinField);
    const usageField = createField("應用任務", "usage", entry.usage, true);
    usageField.classList.add("full");
    fields.appendChild(usageField);
    fields.appendChild(createElement("h3", "section-title", "國中銜接情境"));
    if (Array.isArray(entry.contexts)) {
      for (let index = 0; index < entry.contexts.length; index += 1) {
        const context = entry.contexts[index];
        const contextCard = createElement("section", "context-card");
        contextCard.appendChild(createElement("h3", "", `情境 ${index + 1}: ${context.id}`));
        contextCard.appendChild(createContextField("情境標籤", index, "labelZh", context.labelZh, false));
        contextCard.appendChild(createContextField("情境標籤注音", index, "labelZhuyin", context.labelZhuyin, false));
        const sentence = createContextField("英文情境句", index, "sentence", context.sentence, true);
        sentence.classList.add("full");
        contextCard.appendChild(sentence);
        const sentenceZh = createContextField("中文翻譯", index, "sentenceZh", context.sentenceZh, true);
        sentenceZh.classList.add("full");
        contextCard.appendChild(sentenceZh);
        const sentenceZhuyin = createContextField("中文翻譯注音", index, "sentenceZhuyin", context.sentenceZhuyin, true);
        sentenceZhuyin.classList.add("full");
        contextCard.appendChild(sentenceZhuyin);
        const usageZh = createContextField("用法說明", index, "usageZh", context.usageZh, true);
        usageZh.classList.add("full");
        contextCard.appendChild(usageZh);
        const usageZhuyin = createContextField("用法說明注音", index, "usageZhuyin", context.usageZhuyin, true);
        usageZhuyin.classList.add("full");
        contextCard.appendChild(usageZhuyin);
        fields.appendChild(contextCard);
      }
    }
    card.append(heading, fields);
    els.recordPanel.appendChild(card);
  }

  function renderValidation(messages) {
    els.validationPanel.className = "validation-panel";
    els.validationPanel.textContent = "";
    if (!messages || messages.length === 0) {
      return;
    }
    els.validationPanel.classList.add("is-error");
    els.validationPanel.appendChild(createElement("strong", "", "這筆還不能核准："));
    const list = document.createElement("ul");
    for (const message of messages.slice(0, 12)) {
      list.appendChild(createElement("li", "", message));
    }
    if (messages.length > 12) {
      list.appendChild(createElement("li", "", `還有 ${messages.length - 12} 個問題。`));
    }
    els.validationPanel.appendChild(list);
  }

  function showExportPreview(text) {
    els.exportPreview.value = text;
    els.exportPreview.textContent = text;
    els.exportPreview.hidden = false;
  }

  function renderAll(keepActive) {
    rebuildVisibleIds();
    if (!keepActive || !state.activeId || !state.visibleIds.includes(state.activeId)) {
      state.activeId = state.visibleIds[0] || "";
    }
    updateSummary();
    renderList();
    renderRecord();
    renderValidation([]);
    saveProgress();
  }

  function refreshDerivedFields(entry, errors) {
    entry.zhPairs = buildPairs(entry.zh, entry.zhuyin, `${entry.id} 中文意思`, errors);
    entry.topicZhPairs = buildPairs(entry.topicZh, entry.topicZhuyin, `${entry.id} 情境分類`, errors);
    entry.exampleZhPairs = buildPairs(entry.exampleZh, entry.exampleZhuyin, `${entry.id} 中文翻譯`, errors);
    if (Array.isArray(entry.contexts)) {
      for (const context of entry.contexts) {
        context.labelZhPairs = buildPairs(context.labelZh, context.labelZhuyin, `${entry.id} ${context.id} 情境標籤`, errors);
        context.sentenceZhPairs = buildPairs(context.sentenceZh, context.sentenceZhuyin, `${entry.id} ${context.id} 中文翻譯`, errors);
        context.usageZhPairs = buildPairs(context.usageZh, context.usageZhuyin, `${entry.id} ${context.id} 用法說明`, errors);
      }
    }
  }

  function validatePairField(owner, text, zhuyin, pairs, messages) {
    if (!hasChinese(text)) {
      messages.push(`${owner} 需要有繁體中文。`);
    }
    if (!hasBopomofo(zhuyin)) {
      messages.push(`${owner} 需要有注音。`);
    }
    if (!Array.isArray(pairs) || pairs.length === 0) {
      messages.push(`${owner} pairs 不可為空。`);
      return;
    }
    if (textFromPairs(pairs) !== text) {
      messages.push(`${owner} pairs 與文字不一致。`);
    }
  }

  function validateEnglishSentence(owner, sentence, word, messages) {
    const text = trimText(sentence);
    if (!text) {
      messages.push(`${owner} 英文句不可空白。`);
      return;
    }
    if (!text.toLowerCase().includes(normalizeWord(word))) {
      messages.push(`${owner} 必須包含目標單字 ${word}。`);
    }
    const wordCount = countWords(text);
    if (wordCount < 5 || wordCount > 14) {
      messages.push(`${owner} 要維持國小程度，英文句建議 5 到 14 個字，目前 ${wordCount} 個。`);
    }
    if (text.length > 120) {
      messages.push(`${owner} 英文句過長。`);
    }
    if (text.includes(";") || text.includes(":")) {
      messages.push(`${owner} 避免分號或冒號，降低孩子閱讀負擔。`);
    }
  }

  function validateApprovedRecord(entry) {
    const messages = [];
    for (const field of ["id", "word", "pos", "zh", "zhuyin", "source", "level", "topicZh", "topicZhuyin", "example", "exampleZh", "usage"]) {
      if (!trimText(entry[field])) {
        messages.push(`${entry.id || "unknown"} 缺少 ${field}。`);
      }
    }
    if (containsForbiddenText(entry.example) || containsForbiddenText(entry.exampleZh) || containsForbiddenText(entry.usage)) {
      messages.push(`${entry.id} 仍含有占位或機器候選字樣。`);
    }
    validateEnglishSentence(`${entry.id} 英文例句`, entry.example, entry.word, messages);
    validatePairField(`${entry.id} 中文意思`, entry.zh, entry.zhuyin, entry.zhPairs, messages);
    validatePairField(`${entry.id} 情境分類`, entry.topicZh, entry.topicZhuyin, entry.topicZhPairs, messages);
    validatePairField(`${entry.id} 中文翻譯`, entry.exampleZh, entry.exampleZhuyin, entry.exampleZhPairs, messages);
    if (!Array.isArray(entry.contexts) || entry.contexts.length < 3) {
      messages.push(`${entry.id} 至少需要 3 個情境。`);
      return messages;
    }
    const contextIds = new Set();
    for (const context of entry.contexts) {
      if (contextIds.has(context.id)) {
        messages.push(`${entry.id} 情境 id 重複：${context.id}`);
      }
      contextIds.add(context.id);
      validateEnglishSentence(`${entry.id} ${context.id}`, context.sentence, entry.word, messages);
      validatePairField(`${entry.id} ${context.id} 情境標籤`, context.labelZh, context.labelZhuyin, context.labelZhPairs, messages);
      validatePairField(`${entry.id} ${context.id} 中文翻譯`, context.sentenceZh, context.sentenceZhuyin, context.sentenceZhPairs, messages);
      validatePairField(`${entry.id} ${context.id} 用法說明`, context.usageZh, context.usageZhuyin, context.usageZhPairs, messages);
      if (containsForbiddenText(context.sentence) || containsForbiddenText(context.sentenceZh) || containsForbiddenText(context.usageZh)) {
        messages.push(`${entry.id} ${context.id} 仍含有占位或機器候選字樣。`);
      }
    }
    return messages;
  }

  function buildApprovedEntry(candidate, approvedAt) {
    const entry = deepClone(candidate);
    const errors = [];
    refreshDerivedFields(entry, errors);
    entry.reviewStatus = "approved";
    entry.contentReview = {
      ...(entry.contentReview || {}),
      status: "approved",
      reviewedAt: approvedAt,
      reviewedBy: "local-review-workbench",
      approvalMethod: "manual-visual-review",
      basis: appendUnique(entry.contentReview && entry.contentReview.basis, "human-review-workbench-approved")
    };
    entry.autoQuality = {
      ...(entry.autoQuality || {}),
      status: "human_reviewed",
      reviewedAt: approvedAt,
      reviewTool: "local-review-workbench"
    };
    if (Array.isArray(entry.contexts)) {
      entry.contexts = entry.contexts.map(function (context) {
        return {
          ...context,
          level: "grade-2-friendly",
          reviewStatus: "approved",
          sourceBasis: appendUnique(context.sourceBasis, "human-reviewed-context")
        };
      });
    }
    const validationMessages = validateApprovedRecord(entry);
    return {
      entry,
      errors: errors.concat(validationMessages)
    };
  }

  function approveActive() {
    const entry = collectEntryFromForm();
    if (!entry) {
      return;
    }
    const approvedAt = new Date().toISOString();
    const result = buildApprovedEntry(entry, approvedAt);
    if (result.errors.length > 0) {
      renderValidation(result.errors);
      return;
    }
    saveEditableSnapshot(state.activeId, entry);
    state.progress.approved[state.activeId] = { approvedAt };
    delete state.progress.rejected[state.activeId];
    saveProgress();
    els.validationPanel.className = "validation-panel is-ok";
    els.validationPanel.textContent = "這筆已核准，匯出 JSON 時會轉成 approved。";
    renderAll(false);
  }

  function rejectActive() {
    if (!state.activeId) {
      return;
    }
    const entry = collectEntryFromForm();
    if (entry) {
      saveEditableSnapshot(state.activeId, entry);
    }
    delete state.progress.approved[state.activeId];
    state.progress.rejected[state.activeId] = {
      rejectedAt: new Date().toISOString()
    };
    saveProgress();
    renderAll(false);
  }

  function undoActive() {
    if (!state.activeId) {
      return;
    }
    delete state.progress.approved[state.activeId];
    delete state.progress.rejected[state.activeId];
    saveProgress();
    renderAll(true);
  }

  function moveActive(delta) {
    if (state.visibleIds.length === 0) {
      return;
    }
    const currentIndex = Math.max(0, state.visibleIds.indexOf(state.activeId));
    let nextIndex = currentIndex + delta;
    if (nextIndex < 0) {
      nextIndex = state.visibleIds.length - 1;
    }
    if (nextIndex >= state.visibleIds.length) {
      nextIndex = 0;
    }
    state.activeId = state.visibleIds[nextIndex];
    saveProgress();
    renderAll(true);
  }

  function buildApprovedPayload() {
    const entries = [];
    const errors = [];
    for (const source of state.entries) {
      const approval = state.progress.approved[source.id];
      if (!approval) {
        continue;
      }
      const workingEntry = getWorkingEntry(source.id);
      const approvedAt = approval.approvedAt || new Date().toISOString();
      const result = buildApprovedEntry(workingEntry, approvedAt);
      if (result.errors.length > 0) {
        for (const error of result.errors) {
          errors.push(error);
        }
      } else {
        entries.push(result.entry);
      }
    }
    return {
      payload: {
        metadata: {
          kind: "official-word-bank-reviewed",
          status: "approved",
          generatedAt: new Date().toISOString(),
          generatedBy: "local-review-workbench",
          sourceCandidateFile: "official-word-bank.auto-candidates.json",
          approvedCount: entries.length,
          policy: "Only human approved entries may be imported into official-word-bank.reviewed.json."
        },
        entries
      },
      errors
    };
  }

  function serializeApprovedPayload() {
    const result = buildApprovedPayload();
    if (result.errors.length > 0) {
      renderValidation(result.errors);
      return "";
    }
    if (result.payload.entries.length === 0) {
      renderValidation(["目前沒有 approved 資料可匯出。"]);
      return "";
    }
    const text = `${JSON.stringify(result.payload, null, 2)}\n`;
    showExportPreview(text);
    return text;
  }

  function exportApproved() {
    const text = serializeApprovedPayload();
    if (!text) {
      return;
    }
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = EXPORT_FILE_NAME;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    els.validationPanel.className = "validation-panel is-ok";
    els.validationPanel.textContent = "approved JSON 已匯出。";
  }

  async function copyApproved() {
    const text = serializeApprovedPayload();
    if (!text) {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      els.validationPanel.className = "validation-panel is-ok";
      els.validationPanel.textContent = "approved JSON 已複製到剪貼簿。";
    } catch (error) {
      renderValidation([`剪貼簿寫入失敗，請改用匯出 JSON。${error.message || ""}`]);
    }
  }

  function clearLocalProgress() {
    const confirmed = window.confirm("確定清除本機審核進度？這不會刪除原始候選資料。");
    if (!confirmed) {
      return;
    }
    state.progress = createEmptyProgress();
    localStorage.removeItem(STORAGE_KEY);
    state.activeId = state.visibleIds[0] || "";
    renderAll(true);
  }

  function bindEvents() {
    els.letterFilter.addEventListener("change", function () {
      renderAll(false);
    });
    els.statusFilter.addEventListener("change", function () {
      renderAll(false);
    });
    els.searchInput.addEventListener("input", function () {
      renderAll(false);
    });
    els.recordPanel.addEventListener("input", markActiveEdited);
    els.previousButton.addEventListener("click", function () {
      moveActive(-1);
    });
    els.nextButton.addEventListener("click", function () {
      moveActive(1);
    });
    els.approveButton.addEventListener("click", approveActive);
    els.rejectButton.addEventListener("click", rejectActive);
    els.undoButton.addEventListener("click", undoActive);
    els.exportButton.addEventListener("click", exportApproved);
    els.copyButton.addEventListener("click", copyApproved);
    els.clearLocalButton.addEventListener("click", clearLocalProgress);
  }

  async function loadCandidateData() {
    const response = await fetch(CANDIDATE_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`找不到 ${CANDIDATE_URL}，請先執行 npm run prepare:review-workbench。`);
    }
    const payload = await response.json();
    if (!payload || !Array.isArray(payload.entries) || payload.entries.length === 0) {
      throw new Error("審核候選資料是空的。");
    }
    state.entries = payload.entries.slice().sort(function (a, b) {
      const letterCompare = String(a.sourceLetter || "").localeCompare(String(b.sourceLetter || ""));
      if (letterCompare !== 0) {
        return letterCompare;
      }
      return Number(a.sourceNo || 0) - Number(b.sourceNo || 0);
    });
    state.entryById = new Map();
    for (const entry of state.entries) {
      state.entryById.set(entry.id, entry);
    }
  }

  function cacheElements() {
    for (const id of [
      "letterFilter",
      "statusFilter",
      "searchInput",
      "candidateList",
      "recordPanel",
      "validationPanel",
      "previousButton",
      "nextButton",
      "approveButton",
      "rejectButton",
      "undoButton",
      "exportButton",
      "copyButton",
      "clearLocalButton",
      "loadStatus",
      "reviewTestResult",
      "exportPreview"
    ]) {
      els[id] = document.getElementById(id);
    }
  }

  function runReviewSelfTest() {
    const resultElement = els.reviewTestResult;
    resultElement.hidden = false;
    try {
      if (state.entries.length === 0) {
        throw new Error("No entries loaded.");
      }
      const entry = getWorkingEntry(state.entries[0].id);
      const result = buildApprovedEntry(entry, new Date().toISOString());
      if (result.errors.length > 0) {
        throw new Error(result.errors[0]);
      }
      const payload = {
        metadata: { kind: "official-word-bank-reviewed", status: "approved" },
        entries: [result.entry]
      };
      const reparsed = JSON.parse(JSON.stringify(payload));
      if (!reparsed.entries || reparsed.entries.length !== 1 || reparsed.entries[0].reviewStatus !== "approved") {
        throw new Error("Export payload contract failed.");
      }
      resultElement.textContent = "PASS";
      document.body.dataset.reviewTest = "PASS";
    } catch (error) {
      resultElement.textContent = `FAIL: ${error.message}`;
      document.body.dataset.reviewTest = "FAIL";
    }
  }

  async function init() {
    cacheElements();
    bindEvents();
    try {
      await loadCandidateData();
      const params = new URLSearchParams(window.location.search);
      if (params.has("reviewreset")) {
        localStorage.removeItem(STORAGE_KEY);
      }
      state.progress = loadProgress();
      fillLetterFilter();
      state.activeId = state.progress.activeId || state.entries[0].id;
      renderAll(true);
      els.loadStatus.textContent = "審核資料已載入。";
      if (params.has("reviewtest")) {
        runReviewSelfTest();
      }
    } catch (error) {
      els.loadStatus.textContent = error.message || "審核資料載入失敗。";
      els.loadStatus.classList.add("is-error");
      console.error(error);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
}());
