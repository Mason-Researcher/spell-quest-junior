const fs = require("fs");
const path = require("path");

const {
  pairsFromTextAndZhuyin,
  textFromPairs,
  zhuyinForChineseText
} = require("./zhuyin_utils");
const {
  getImportConfig
} = require("./official_import_config");

const config = getImportConfig();
const root = config.root;
const importRoot = config.importRoot;
const importBasename = config.basename;
const draftPath = config.reviewedDraftPath;
const candidatePath = config.autoCandidatesPath;
const candidateReportPath = config.autoCandidatesReportPath;
const providerRequestPath = config.providerRequestsPath;
const siteWordsPath = path.join(root, "site", "data", "words.json");

const BANNED_PLACEHOLDER_TEXT = [
  "todo",
  "tbd",
  "placeholder",
  "teacher-approved sentence is added",
  "until a teacher",
  "needs_review"
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  fs.writeFileSync(filePath, value, "utf8");
}

function normalizeWord(value) {
  return String(value || "").trim().toLowerCase();
}

function cleanAsciiWord(value) {
  let output = "";
  for (const char of String(value || "")) {
    const code = char.charCodeAt(0);
    const upper = code >= 65 && code <= 90;
    const lower = code >= 97 && code <= 122;
    const hyphen = char === "-";
    const space = char === " ";
    if (upper || lower || hyphen || space) {
      output += char;
    }
  }
  return output.trim();
}

function countWords(sentence) {
  return String(sentence || "").split(" ").filter((part) => part.trim().length > 0).length;
}

function hasChinese(text) {
  for (const char of String(text || "")) {
    const code = char.charCodeAt(0);
    if ((code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0xf900 && code <= 0xfaff)) {
      return true;
    }
  }
  return false;
}

function hasBopomofo(text) {
  for (const char of String(text || "")) {
    const code = char.charCodeAt(0);
    if (code >= 0x3100 && code <= 0x312f) {
      return true;
    }
  }
  return false;
}

function containsForbiddenText(value) {
  const text = String(value || "").toLowerCase();
  for (const banned of BANNED_PLACEHOLDER_TEXT) {
    if (text.includes(banned)) {
      return true;
    }
  }
  return false;
}

function stripTerminalPunctuation(value) {
  let text = String(value || "").trim();
  while (text.endsWith(".") || text.endsWith("。") || text.endsWith("!") || text.endsWith("！")) {
    text = text.slice(0, text.length - 1).trim();
  }
  return text;
}

function buildPairs(text) {
  const zhuyin = zhuyinForChineseText(text);
  const pairs = pairsFromTextAndZhuyin(text, zhuyin);
  if (textFromPairs(pairs) !== text) {
    throw new Error(`Pair text mismatch: ${text}`);
  }
  return { zhuyin, pairs };
}

function cloneBaseCandidate(draftEntry) {
  return {
    id: draftEntry.id,
    word: draftEntry.word,
    pos: draftEntry.pos,
    zh: draftEntry.zh,
    zhuyin: draftEntry.zhuyin,
    source: draftEntry.source,
    level: draftEntry.level,
    topic: draftEntry.topic,
    topicZh: draftEntry.topicZh,
    topicZhuyin: draftEntry.topicZhuyin,
    starred: draftEntry.starred,
    zhPairs: draftEntry.zhPairs,
    topicZhPairs: draftEntry.topicZhPairs,
    sourceKey: draftEntry.sourceKey,
    sourceLetter: draftEntry.sourceLetter,
    sourceNo: draftEntry.sourceNo,
    zhAlternatives: draftEntry.zhAlternatives || []
  };
}

function addGeneratedChineseFields(entry) {
  const example = buildPairs(entry.exampleZh);
  entry.exampleZhuyin = example.zhuyin;
  entry.exampleZhPairs = example.pairs;
  for (const context of entry.contexts) {
    const label = buildPairs(context.labelZh);
    const sentence = buildPairs(context.sentenceZh);
    const usage = buildPairs(context.usageZh);
    context.labelZhuyin = label.zhuyin;
    context.labelZhPairs = label.pairs;
    context.sentenceZhuyin = sentence.zhuyin;
    context.sentenceZhPairs = sentence.pairs;
    context.usageZhuyin = usage.zhuyin;
    context.usageZhPairs = usage.pairs;
  }
}

function validatePairField(owner, text, zhuyin, pairs, messages) {
  if (!hasChinese(text)) {
    messages.push(`${owner} must contain Traditional Chinese text.`);
  }
  if (!hasBopomofo(zhuyin)) {
    messages.push(`${owner} zhuyin must contain bopomofo.`);
  }
  if (!Array.isArray(pairs) || pairs.length === 0) {
    messages.push(`${owner} pairs are empty.`);
    return;
  }
  if (textFromPairs(pairs) !== text) {
    messages.push(`${owner} pair text mismatch.`);
  }
  let rebuilt = [];
  try {
    rebuilt = pairsFromTextAndZhuyin(text, zhuyin);
  } catch (error) {
    messages.push(`${owner} cannot rebuild pairs: ${error.message}`);
    return;
  }
  if (JSON.stringify(rebuilt) !== JSON.stringify(pairs)) {
    messages.push(`${owner} pairs do not match zhuyin.`);
  }
}

function validateEnglishSentence(owner, sentence, word, messages) {
  const text = String(sentence || "").trim();
  if (!text) {
    messages.push(`${owner} sentence is empty.`);
    return;
  }
  if (!text.toLowerCase().includes(normalizeWord(word))) {
    messages.push(`${owner} sentence must include target word ${word}.`);
  }
  const wordCount = countWords(text);
  if (wordCount < 5 || wordCount > 14) {
    messages.push(`${owner} sentence word count must be 5-14, got ${wordCount}.`);
  }
  if (text.length > 120) {
    messages.push(`${owner} sentence is too long.`);
  }
  if (text.includes(";") || text.includes(":")) {
    messages.push(`${owner} sentence should avoid complex punctuation.`);
  }
}

function validateCandidateEntry(entry, messages) {
  const required = [
    "id",
    "word",
    "pos",
    "zh",
    "zhuyin",
    "source",
    "level",
    "topic",
    "topicZh",
    "topicZhuyin",
    "starred",
    "example",
    "usage",
    "exampleZh",
    "exampleZhuyin",
    "exampleZhPairs",
    "contentReview",
    "contexts",
    "autoQuality",
    "reviewStatus",
    "sourceKey"
  ];
  for (const field of required) {
    if (entry[field] === undefined || entry[field] === null || entry[field] === "") {
      messages.push(`${entry.id || "unknown"} missing ${field}.`);
    }
  }
  if (entry.reviewStatus !== "machine_candidate") {
    messages.push(`${entry.id} reviewStatus must be machine_candidate.`);
  }
  if (!entry.contentReview || entry.contentReview.status !== "machine_candidate") {
    messages.push(`${entry.id} contentReview.status must be machine_candidate.`);
  }
  if (!entry.autoQuality || entry.autoQuality.status !== "ready_for_review") {
    messages.push(`${entry.id} autoQuality.status must be ready_for_review.`);
  }
  if (containsForbiddenText(entry.example) || containsForbiddenText(entry.usage) || containsForbiddenText(entry.exampleZh)) {
    messages.push(`${entry.id} contains forbidden placeholder text.`);
  }
  validateEnglishSentence(`${entry.id} example`, entry.example, entry.word, messages);
  validatePairField(`${entry.id} exampleZh`, entry.exampleZh, entry.exampleZhuyin, entry.exampleZhPairs, messages);
  if (!Array.isArray(entry.contexts) || entry.contexts.length < 3) {
    messages.push(`${entry.id} must have at least 3 contexts.`);
    return;
  }
  const contextIds = new Set();
  for (const context of entry.contexts) {
    if (contextIds.has(context.id)) {
      messages.push(`${entry.id} duplicate context id ${context.id}.`);
    }
    contextIds.add(context.id);
    if (context.reviewStatus !== "machine_candidate") {
      messages.push(`${entry.id} context ${context.id} must be machine_candidate.`);
    }
    if (context.level !== "grade-2-friendly") {
      messages.push(`${entry.id} context ${context.id} level must be grade-2-friendly.`);
    }
    validateEnglishSentence(`${entry.id} context ${context.id}`, context.sentence, entry.word, messages);
    validatePairField(`${entry.id} context ${context.id} labelZh`, context.labelZh, context.labelZhuyin, context.labelZhPairs, messages);
    validatePairField(`${entry.id} context ${context.id} sentenceZh`, context.sentenceZh, context.sentenceZhuyin, context.sentenceZhPairs, messages);
    validatePairField(`${entry.id} context ${context.id} usageZh`, context.usageZh, context.usageZhuyin, context.usageZhPairs, messages);
    if (!Array.isArray(context.sourceBasis) || context.sourceBasis.length < 1) {
      messages.push(`${entry.id} context ${context.id} sourceBasis is required.`);
    }
  }
}

module.exports = {
  addGeneratedChineseFields,
  buildPairs,
  candidatePath,
  candidateReportPath,
  cleanAsciiWord,
  cloneBaseCandidate,
  containsForbiddenText,
  countWords,
  draftPath,
  hasBopomofo,
  hasChinese,
  importBasename,
  importRoot,
  normalizeWord,
  providerRequestPath,
  readJson,
  root,
  siteWordsPath,
  stripTerminalPunctuation,
  validateCandidateEntry,
  validateEnglishSentence,
  validatePairField,
  writeJson,
  writeText
};
