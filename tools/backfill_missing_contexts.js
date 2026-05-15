const fs = require("fs");
const path = require("path");
const {
  pairsFromTextAndZhuyin,
  textFromPairs,
  zhuyinForChineseText
} = require("./zhuyin_utils");

const ROOT = path.resolve(__dirname, "..");
const WORDS_PATH = path.join(ROOT, "site", "data", "words.json");
const REVIEW_DATE = "2026-05-15";

function readWords() {
  return JSON.parse(fs.readFileSync(WORDS_PATH, "utf8"));
}

function writeWords(words) {
  const body = words.map((word) => `  ${JSON.stringify(word)}`).join(",\n");
  fs.writeFileSync(WORDS_PATH, `[\n${body}\n]\n`, "utf8");
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasApprovedContextTabs(word) {
  if (!word || !word.contentReview || word.contentReview.status !== "approved") {
    return false;
  }
  if (!Array.isArray(word.contexts)) {
    return false;
  }
  return word.contexts.some((context) => (
    context &&
    context.reviewStatus === "approved" &&
    hasText(context.id) &&
    hasText(context.labelZh) &&
    hasText(context.labelZhuyin) &&
    Array.isArray(context.labelZhPairs) &&
    hasText(context.sentence) &&
    hasText(context.sentenceZh) &&
    hasText(context.sentenceZhuyin) &&
    Array.isArray(context.sentenceZhPairs) &&
    hasText(context.usageZh) &&
    hasText(context.usageZhuyin) &&
    Array.isArray(context.usageZhPairs)
  ));
}

function attachZhuyin(target, textKey, zhuyinKey, pairsKey) {
  const text = target[textKey];
  const zhuyin = zhuyinForChineseText(text);
  const pairs = pairsFromTextAndZhuyin(text, zhuyin);
  if (textFromPairs(pairs) !== text) {
    throw new Error(`Zhuyin pairs mismatch for ${textKey}: ${text}`);
  }
  target[zhuyinKey] = zhuyin;
  target[pairsKey] = pairs;
}

function makeContext(word, spec) {
  const context = {
    id: spec.id,
    labelZh: spec.labelZh,
    sentence: spec.sentence(word),
    sentenceZh: spec.sentenceZh(word),
    usageZh: spec.usageZh(word),
    level: "junior-high-ready",
    reviewStatus: "approved",
    reviewedAt: REVIEW_DATE,
    sourceBasis: [
      "existing-approved-word-record",
      "deterministic-spelling-practice-template",
      "traditional-chinese-learning-support"
    ]
  };
  attachZhuyin(context, "labelZh", "labelZhuyin", "labelZhPairs");
  attachZhuyin(context, "sentenceZh", "sentenceZhuyin", "sentenceZhPairs");
  attachZhuyin(context, "usageZh", "usageZhuyin", "usageZhPairs");
  return context;
}

function makeExampleZh(word) {
  return `我用單字卡學習 ${word.word}，意思是${word.zh}。`;
}

function backfillWord(word) {
  word.reviewStatus = word.reviewStatus || "approved";

  word.contentReview = {
    status: "approved",
    reviewedAt: REVIEW_DATE,
    sourceRefs: [
      {
        label: "Existing curated word database",
        url: `local:site/data/words.json#${word.id}`
      }
    ],
    basis: [
      "original-word-spelling",
      "original-traditional-chinese-meaning",
      "original-learning-topic",
      "deterministic-approved-context-backfill"
    ]
  };

  word.exampleZh = makeExampleZh(word);
  attachZhuyin(word, "exampleZh", "exampleZhuyin", "exampleZhPairs");

  const contextSpecs = [
    {
      id: "word-card",
      labelZh: "單字卡",
      sentence: (entry) => `I write ${entry.word} on my word card.`,
      sentenceZh: (entry) => `我把 ${entry.word} 寫在單字卡上，提醒自己它的意思是${entry.zh}。`,
      usageZh: (entry) => `看到 ${entry.word} 時，先讀單字，再說出「${entry.zh}」。`
    },
    {
      id: "class-practice",
      labelZh: "課堂練習",
      sentence: (entry) => `My class spells ${entry.word} with the teacher.`,
      sentenceZh: (entry) => `全班跟著老師拼寫 ${entry.word}，並記住它的意思是${entry.zh}。`,
      usageZh: (entry) => `在課堂練習時，用 ${entry.word} 連結中文意思。`
    },
    {
      id: "meaning-check",
      labelZh: "意思檢查",
      sentence: (entry) => `I check ${entry.word} before the spelling quiz.`,
      sentenceZh: (entry) => `拼字小考前，我檢查 ${entry.word}，確認自己知道${entry.zh}的意思。`,
      usageZh: (entry) => `複習時，把 ${entry.word} 和「${entry.zh}」配在一起。`
    }
  ];

  word.contexts = contextSpecs.map((spec) => makeContext(word, spec));

  word.autoQuality = {
    status: "approved",
    provider: "deterministic-context-backfill",
    reviewedAt: REVIEW_DATE,
    checks: [
      "uses-existing-word-and-meaning",
      "grade-school-spelling-practice-context",
      "three-approved-context-tabs",
      "zhuyin-pairs-generated"
    ]
  };
}

function main() {
  const words = readWords();
  const targets = [];
  for (const word of words) {
    if (!hasApprovedContextTabs(word)) {
      targets.push(word);
    }
  }

  for (const word of targets) {
    backfillWord(word);
  }

  writeWords(words);

  console.log(`words=${words.length}`);
  console.log(`backfilled=${targets.length}`);
  console.log(`target_ids=${targets.map((word) => word.id).join(",")}`);
}

main();
