const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const wordsPath = path.join(root, "site", "data", "words.json");
const goldenWordIds = [
  "D001",
  "D002",
  "D003",
  "D005",
  "D012",
  "D020",
  "D021",
  "D022",
  "D023",
  "D028"
];

const requiredWordFields = [
  "exampleZh",
  "exampleZhuyin",
  "contexts",
  "contentReview"
];

const requiredContextFields = [
  "id",
  "level",
  "labelZh",
  "labelZhuyin",
  "sentence",
  "sentenceZh",
  "sentenceZhuyin",
  "usageZh",
  "usageZhuyin",
  "sourceBasis",
  "reviewStatus"
];

const bopomofoChars = "ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄧㄨㄩㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦˊˇˋ˙";

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function isPresent(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function sentenceIncludesWord(sentence, word) {
  return sentence.toLowerCase().includes(word.toLowerCase());
}

function hasBopomofo(value) {
  const text = String(value || "");
  for (const char of bopomofoChars) {
    if (text.includes(char)) {
      return true;
    }
  }
  return false;
}

function hasForbiddenPlaceholder(value) {
  const text = String(value || "").toLowerCase();
  return text.includes("todo") ||
    text.includes("tbd") ||
    text.includes("placeholder") ||
    text.includes("???") ||
    text.includes("�") ||
    text.includes("待補");
}

function sourceRefsToText(sourceRefs) {
  const parts = [];
  for (const ref of sourceRefs) {
    if (typeof ref === "string") {
      parts.push(ref);
    } else if (ref && typeof ref === "object") {
      parts.push(ref.label || "");
      parts.push(ref.url || "");
    }
  }
  return parts.join("\n").toLowerCase();
}

function hasLearnerDictionarySources(sourceRefs) {
  const joined = sourceRefsToText(sourceRefs);
  return joined.includes("dictionary.cambridge.org") &&
    joined.includes("britannica.com/dictionary");
}

const words = JSON.parse(fs.readFileSync(wordsPath, "utf8"));
const wordById = new Map(words.map((word) => [word.id, word]));

for (const id of goldenWordIds) {
  const word = wordById.get(id);
  if (!word) {
    fail(`Missing golden sample word: ${id}`);
    continue;
  }

  for (const field of requiredWordFields) {
    if (!(field in word)) {
      fail(`${id} missing ${field}`);
    }
  }

  if (!isPresent(word.exampleZh)) {
    fail(`${id} exampleZh is empty`);
  }
  if (!isPresent(word.exampleZhuyin)) {
    fail(`${id} exampleZhuyin is empty`);
  }
  if (!hasBopomofo(word.exampleZhuyin)) {
    fail(`${id} exampleZhuyin must contain zhuyin`);
  }
  if (hasForbiddenPlaceholder(word.exampleZh) || hasForbiddenPlaceholder(word.exampleZhuyin)) {
    fail(`${id} example translation contains placeholder text`);
  }
  if (!word.contentReview || word.contentReview.status !== "approved") {
    fail(`${id} contentReview.status must be approved`);
  }
  if (!word.contentReview || !Array.isArray(word.contentReview.sourceRefs) || word.contentReview.sourceRefs.length < 2) {
    fail(`${id} contentReview.sourceRefs requires at least two learner dictionary references`);
  } else if (!hasLearnerDictionarySources(word.contentReview.sourceRefs)) {
    fail(`${id} contentReview.sourceRefs must include Cambridge and Britannica dictionary references`);
  }
  if (!Array.isArray(word.contexts) || word.contexts.length < 3) {
    fail(`${id} must have at least 3 contexts`);
    continue;
  }

  const seenContextIds = new Set();
  for (const context of word.contexts) {
    for (const field of requiredContextFields) {
      if (!(field in context)) {
        fail(`${id} context missing ${field}`);
      }
    }
    if (seenContextIds.has(context.id)) {
      fail(`${id} duplicate context id: ${context.id}`);
    }
    seenContextIds.add(context.id);
    if (context.reviewStatus !== "approved") {
      fail(`${id} context ${context.id} must be approved`);
    }
    if (context.level !== "junior-high-ready") {
      fail(`${id} context ${context.id} level must be junior-high-ready`);
    }
    if (!sentenceIncludesWord(context.sentence, word.word)) {
      fail(`${id} context ${context.id} sentence must include ${word.word}`);
    }
    if (context.sentence.length < 20 || context.sentence.length > 160) {
      fail(`${id} context ${context.id} sentence length is outside learner-friendly bounds`);
    }
    if (!hasBopomofo(context.labelZhuyin) || !hasBopomofo(context.sentenceZhuyin) || !hasBopomofo(context.usageZhuyin)) {
      fail(`${id} context ${context.id} zhuyin fields must contain zhuyin`);
    }
    for (const field of requiredContextFields) {
      if (field === "sourceBasis") {
        if (!Array.isArray(context.sourceBasis) || context.sourceBasis.length < 1) {
          fail(`${id} context ${context.id} sourceBasis is required`);
        } else if (context.sourceBasis.some((item) => !isPresent(item) || hasForbiddenPlaceholder(item))) {
          fail(`${id} context ${context.id} sourceBasis contains invalid text`);
        }
      } else if (!isPresent(context[field])) {
        fail(`${id} context ${context.id} ${field} is empty`);
      } else if (hasForbiddenPlaceholder(context[field])) {
        fail(`${id} context ${context.id} ${field} contains placeholder text`);
      }
    }
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("PASSED context_data=ok golden_samples=10");
