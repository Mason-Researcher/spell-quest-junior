const path = require("path");

const {
  containsForbiddenText,
  countWords,
  hasBopomofo,
  hasChinese,
  importRoot,
  normalizeWord,
  readJson,
  siteWordsPath,
  validateEnglishSentence,
  validatePairField
} = require("./official_candidate_common");

const defaultReviewedPath = path.join(importRoot, "official-word-bank.reviewed.json");

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || index + 1 >= process.argv.length) {
    return "";
  }
  return process.argv[index + 1];
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function toPositiveInteger(value, fallback) {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 0) {
    return parsed;
  }
  return fallback;
}

function requireText(entry, field, messages) {
  if (entry[field] === undefined || entry[field] === null || String(entry[field]).trim() === "") {
    messages.push(`${entry.id || "unknown"} missing ${field}.`);
  }
}

function validateApprovedStatus(entry, messages) {
  if (entry.reviewStatus !== "approved") {
    messages.push(`${entry.id} reviewStatus must be approved.`);
  }
  if (!entry.contentReview || entry.contentReview.status !== "approved") {
    messages.push(`${entry.id} contentReview.status must be approved.`);
  }
  if (!entry.contentReview || !entry.contentReview.reviewedAt) {
    messages.push(`${entry.id} contentReview.reviewedAt is required.`);
  }
  if (entry.autoQuality && entry.autoQuality.status === "ready_for_review") {
    messages.push(`${entry.id} autoQuality.status still says ready_for_review.`);
  }
  if (entry.contentReview && Array.isArray(entry.contentReview.basis)) {
    if (!entry.contentReview.basis.includes("human-review-workbench-approved")) {
      messages.push(`${entry.id} contentReview.basis must include human-review-workbench-approved.`);
    }
  } else {
    messages.push(`${entry.id} contentReview.basis is required.`);
  }
}

function validateChineseField(owner, text, zhuyin, pairs, messages) {
  if (!hasChinese(text)) {
    messages.push(`${owner} must contain Traditional Chinese.`);
  }
  if (!hasBopomofo(zhuyin)) {
    messages.push(`${owner} zhuyin must contain bopomofo.`);
  }
  validatePairField(owner, text, zhuyin, pairs, messages);
}

function validateContext(entry, context, index, messages) {
  const owner = `${entry.id} context ${context.id || index + 1}`;
  for (const field of ["id", "labelZh", "labelZhuyin", "sentence", "sentenceZh", "sentenceZhuyin", "usageZh", "usageZhuyin"]) {
    if (context[field] === undefined || context[field] === null || String(context[field]).trim() === "") {
      messages.push(`${owner} missing ${field}.`);
    }
  }
  if (context.reviewStatus !== "approved") {
    messages.push(`${owner} reviewStatus must be approved.`);
  }
  if (context.level !== "grade-2-friendly") {
    messages.push(`${owner} level must be grade-2-friendly.`);
  }
  if (!Array.isArray(context.sourceBasis) || context.sourceBasis.length === 0) {
    messages.push(`${owner} sourceBasis is required.`);
  }
  if (containsForbiddenText(context.sentence) || containsForbiddenText(context.sentenceZh) || containsForbiddenText(context.usageZh)) {
    messages.push(`${owner} contains forbidden placeholder text.`);
  }
  validateEnglishSentence(owner, context.sentence, entry.word, messages);
  validateChineseField(`${owner} labelZh`, context.labelZh, context.labelZhuyin, context.labelZhPairs, messages);
  validateChineseField(`${owner} sentenceZh`, context.sentenceZh, context.sentenceZhuyin, context.sentenceZhPairs, messages);
  validateChineseField(`${owner} usageZh`, context.usageZh, context.usageZhuyin, context.usageZhPairs, messages);
}

function validateEntry(entry, messages) {
  for (const field of [
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
    "example",
    "exampleZh",
    "exampleZhuyin",
    "usage",
    "contexts",
    "contentReview",
    "sourceKey"
  ]) {
    requireText(entry, field, messages);
  }
  validateApprovedStatus(entry, messages);
  if (containsForbiddenText(entry.example) || containsForbiddenText(entry.exampleZh) || containsForbiddenText(entry.usage)) {
    messages.push(`${entry.id} contains forbidden placeholder text.`);
  }
  validateEnglishSentence(`${entry.id} example`, entry.example, entry.word, messages);
  if (countWords(entry.example) > 14) {
    messages.push(`${entry.id} example is above grade-2 sentence length.`);
  }
  validateChineseField(`${entry.id} zh`, entry.zh, entry.zhuyin, entry.zhPairs, messages);
  validateChineseField(`${entry.id} topicZh`, entry.topicZh, entry.topicZhuyin, entry.topicZhPairs, messages);
  validateChineseField(`${entry.id} exampleZh`, entry.exampleZh, entry.exampleZhuyin, entry.exampleZhPairs, messages);
  if (!Array.isArray(entry.contexts) || entry.contexts.length < 3) {
    messages.push(`${entry.id} must have at least 3 approved contexts.`);
    return;
  }
  const contextIds = new Set();
  for (let index = 0; index < entry.contexts.length; index += 1) {
    const context = entry.contexts[index];
    if (contextIds.has(context.id)) {
      messages.push(`${entry.id} duplicate context id: ${context.id}`);
    }
    contextIds.add(context.id);
    validateContext(entry, context, index, messages);
  }
}

function validateUniqueness(entries, messages, allowSiteCollisions) {
  const siteWords = readJson(siteWordsPath);
  const siteIds = new Set(siteWords.map((word) => String(word.id)));
  const siteWordSet = new Set(siteWords.map((word) => normalizeWord(word.word)));
  const siteById = new Map();
  for (const word of siteWords) {
    siteById.set(String(word.id), normalizeWord(word.word));
  }
  const seenIds = new Set();
  const seenWords = new Set();
  for (const entry of entries) {
    if (seenIds.has(entry.id)) {
      messages.push(`Duplicate reviewed id: ${entry.id}`);
    }
    seenIds.add(entry.id);
    if (siteIds.has(entry.id)) {
      if (!allowSiteCollisions) {
        messages.push(`Reviewed id collides with site words: ${entry.id}`);
      } else if (siteById.get(String(entry.id)) !== normalizeWord(entry.word)) {
        messages.push(`Reviewed id collides with a different site word: ${entry.id}`);
      }
    }
    const word = normalizeWord(entry.word);
    if (seenWords.has(word)) {
      messages.push(`Duplicate reviewed word: ${entry.word}`);
    }
    seenWords.add(word);
    if (siteWordSet.has(word) && !allowSiteCollisions) {
      messages.push(`Reviewed word already exists in site words: ${entry.word}`);
    }
  }
}

function main() {
  const inputPath = readArg("--input") || defaultReviewedPath;
  const minimum = toPositiveInteger(readArg("--min"), 0);
  const allowSiteCollisions = hasFlag("--allow-site-collisions");
  const payload = readJson(path.resolve(inputPath));
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  const messages = [];
  if (minimum > 0 && entries.length < minimum) {
    messages.push(`Reviewed entries below minimum: ${entries.length} < ${minimum}`);
  }
  validateUniqueness(entries, messages, allowSiteCollisions);
  for (const entry of entries) {
    validateEntry(entry, messages);
  }
  if (messages.length > 0) {
    console.log("FAILED");
    for (const message of messages.slice(0, 120)) {
      console.log(`- ${message}`);
    }
    if (messages.length > 120) {
      console.log(`- ... ${messages.length - 120} more`);
    }
    process.exit(1);
  }
  console.log("PASSED");
  console.log(`reviewed_entries=${entries.length}`);
  console.log(`input=${inputPath}`);
}

main();
