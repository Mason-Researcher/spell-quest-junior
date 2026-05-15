const fs = require("fs");
const path = require("path");
const { textFromPairs } = require("./zhuyin_utils");

const ROOT = path.resolve(__dirname, "..");
const WORDS_PATH = path.join(ROOT, "site", "data", "words.json");
const ALLOWED_LEVELS = new Set(["grade-2-friendly", "junior-high-ready"]);

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
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

function assertPairs(wordId, contextId, label, text, pairs) {
  if (!Array.isArray(pairs) || pairs.length === 0) {
    fail(`${wordId}/${contextId}: ${label} pairs are missing.`);
    return;
  }
  const pairText = textFromPairs(pairs);
  if (pairText !== text) {
    fail(`${wordId}/${contextId}: ${label} pairs text mismatch.`);
  }
}

function isApprovedContext(context) {
  return context && context.reviewStatus === "approved";
}

function validateContext(word, context, seenIds) {
  const prefix = `${word.id}/${context && context.id ? context.id : "missing-id"}`;
  if (!hasText(context.id)) {
    fail(`${prefix}: missing id.`);
  } else if (seenIds.has(context.id)) {
    fail(`${prefix}: duplicate context id.`);
  } else {
    seenIds.add(context.id);
  }
  if (!hasText(context.labelZh)) fail(`${prefix}: missing labelZh.`);
  if (!hasText(context.labelZhuyin) || !hasBopomofo(context.labelZhuyin)) fail(`${prefix}: missing labelZhuyin.`);
  if (!hasText(context.sentence)) fail(`${prefix}: missing sentence.`);
  if (!context.sentence.toLowerCase().includes(word.word.toLowerCase())) fail(`${prefix}: sentence does not include target word.`);
  if (!hasText(context.sentenceZh)) fail(`${prefix}: missing sentenceZh.`);
  if (!hasText(context.sentenceZhuyin) || !hasBopomofo(context.sentenceZhuyin)) fail(`${prefix}: missing sentenceZhuyin.`);
  if (!hasText(context.usageZh)) fail(`${prefix}: missing usageZh.`);
  if (!hasText(context.usageZhuyin) || !hasBopomofo(context.usageZhuyin)) fail(`${prefix}: missing usageZhuyin.`);
  if (!ALLOWED_LEVELS.has(context.level)) fail(`${prefix}: level must be grade-2-friendly or junior-high-ready.`);
  assertPairs(word.id, context.id, "labelZh", context.labelZh, context.labelZhPairs);
  assertPairs(word.id, context.id, "sentenceZh", context.sentenceZh, context.sentenceZhPairs);
  assertPairs(word.id, context.id, "usageZh", context.usageZh, context.usageZhPairs);
}

function main() {
  const words = JSON.parse(fs.readFileSync(WORDS_PATH, "utf8"));
  let wordsWithApprovedContexts = 0;
  let approvedContextCount = 0;

  for (const word of words) {
    if (!word.contentReview || word.contentReview.status !== "approved") {
      fail(`${word.id}: contentReview.status must be approved.`);
      continue;
    }
    if (!Array.isArray(word.contexts)) {
      fail(`${word.id}: contexts must be an array.`);
      continue;
    }

    const contexts = word.contexts.filter(isApprovedContext);
    if (contexts.length !== 3) {
      fail(`${word.id}: expected exactly 3 approved contexts, got ${contexts.length}.`);
    }
    if (contexts.length > 0) {
      wordsWithApprovedContexts += 1;
      approvedContextCount += contexts.length;
    }

    const seenIds = new Set();
    for (const context of contexts) {
      validateContext(word, context, seenIds);
    }
  }

  if (process.exitCode) {
    return;
  }

  console.log("context_coverage=ok");
  console.log(`words=${words.length}`);
  console.log(`words_with_approved_contexts=${wordsWithApprovedContexts}`);
  console.log(`approved_contexts=${approvedContextCount}`);
}

main();
