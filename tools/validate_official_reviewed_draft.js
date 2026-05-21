const fs = require("fs");
const path = require("path");

const {
  pairsFromTextAndZhuyin,
  pinyinSyllableToZhuyin,
  textFromPairs,
  zhuyinForChineseText
} = require("./zhuyin_utils");
const {
  getImportConfig
} = require("./official_import_config");

const config = getImportConfig();
const root = config.root;
const draftPath = config.reviewedDraftPath;
const previewPath = config.reviewedDraftPreviewPath;
const queuePath = config.reviewQueuePath;
const siteWordsPath = path.join(root, "site", "data", "words.json");

const requiredFields = [
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
  "reviewStatus",
  "zhPairs",
  "topicZhPairs",
  "sourceKey"
];

const allowedLevels = new Set(["starter", "bridge", "challenge"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeWord(value) {
  return String(value || "").trim().toLowerCase();
}

function hasBopomofo(value) {
  for (const char of String(value || "")) {
    const code = char.charCodeAt(0);
    if (code >= 0x3100 && code <= 0x312f) {
      return true;
    }
  }
  return false;
}

function isSupportedWord(value) {
  const text = String(value || "").replaceAll(" ", "").replaceAll("-", "");
  if (!text) {
    return false;
  }
  for (const char of text) {
    const code = char.charCodeAt(0);
    const upper = code >= 65 && code <= 90;
    const lower = code >= 97 && code <= 122;
    if (!upper && !lower) {
      return false;
    }
  }
  return true;
}

function validateGoldenZhuyin(messages) {
  const cases = [
    ["mei3", "ㄇㄟˇ"],
    ["ri4", "ㄖˋ"],
    ["de0", "ㄉㄜ˙"],
    ["xue2", "ㄒㄩㄝˊ"],
    ["xiao4", "ㄒㄧㄠˋ"],
    ["guo2", "ㄍㄨㄛˊ"],
    ["jue2", "ㄐㄩㄝˊ"],
    ["yuan2", "ㄩㄢˊ"],
    ["zi0", "ㄗ˙"],
    ["zhong1", "ㄓㄨㄥ"]
  ];
  for (const item of cases) {
    const actual = pinyinSyllableToZhuyin(item[0]);
    if (actual !== item[1]) {
      messages.push(`Zhuyin converter mismatch ${item[0]}: ${actual} != ${item[1]}`);
    }
  }
  const phrase = zhuyinForChineseText("每日的");
  if (phrase !== "ㄇㄟˇ ㄖˋ ㄉㄜ˙") {
    messages.push(`Zhuyin phrase mismatch 每日的: ${phrase}`);
  }
}

function validatePairs(owner, text, zhuyin, pairs, messages) {
  if (!Array.isArray(pairs) || pairs.length === 0) {
    messages.push(`${owner} missing pair array.`);
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
    messages.push(`${owner} pair array does not match generated zhuyin.`);
  }
  for (const pair of pairs) {
    if (!pair || !Object.prototype.hasOwnProperty.call(pair, "text") || !Object.prototype.hasOwnProperty.call(pair, "bpmf")) {
      messages.push(`${owner} has invalid pair object.`);
    }
  }
}

function validateDraftEntry(entry, messages) {
  for (const field of requiredFields) {
    if (entry[field] === undefined || entry[field] === null || entry[field] === "") {
      messages.push(`${entry.id || "unknown"} missing ${field}.`);
    }
  }
  if (!allowedLevels.has(entry.level)) {
    messages.push(`${entry.id} has invalid level ${entry.level}.`);
  }
  if (!isSupportedWord(entry.word)) {
    messages.push(`${entry.id} has unsupported word ${entry.word}.`);
  }
  if (entry.reviewStatus !== "needs_review") {
    messages.push(`${entry.id} must remain needs_review.`);
  }
  if (!hasBopomofo(entry.zhuyin)) {
    messages.push(`${entry.id} zhuyin has no bopomofo.`);
  }
  if (!hasBopomofo(entry.topicZhuyin)) {
    messages.push(`${entry.id} topicZhuyin has no bopomofo.`);
  }
  if (!String(entry.example || "").toLowerCase().includes(normalizeWord(entry.word))) {
    messages.push(`${entry.id} example must include word.`);
  }
  validatePairs(`${entry.id} zh`, entry.zh, entry.zhuyin, entry.zhPairs, messages);
  validatePairs(`${entry.id} topicZh`, entry.topicZh, entry.topicZhuyin, entry.topicZhPairs, messages);
}

function validateUniqueIds(entries, siteWords, messages, allowSiteCollisions) {
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      messages.push(`Duplicate draft id: ${entry.id}`);
    }
    seen.add(entry.id);
  }
  const siteIds = new Set(siteWords.map((word) => String(word.id)));
  const siteById = new Map();
  for (const word of siteWords) {
    siteById.set(String(word.id), normalizeWord(word.word));
  }
  for (const entry of entries) {
    if (siteIds.has(entry.id)) {
      if (!allowSiteCollisions) {
        messages.push(`Draft id collides with site id: ${entry.id}`);
      } else if (siteById.get(String(entry.id)) !== normalizeWord(entry.word)) {
        messages.push(`Draft id collides with a different site word: ${entry.id}`);
      }
    }
  }
}

function validateNoDuplicateWords(entries, siteWords, messages, allowSiteCollisions) {
  const siteWordsSet = new Set(siteWords.map((word) => normalizeWord(word.word)));
  for (const entry of entries) {
    if (siteWordsSet.has(normalizeWord(entry.word)) && !allowSiteCollisions) {
      messages.push(`Draft word already exists in site words: ${entry.word}`);
    }
  }
  const seen = new Set();
  for (const entry of entries) {
    const word = normalizeWord(entry.word);
    if (seen.has(word)) {
      messages.push(`Duplicate draft word: ${entry.word}`);
    }
    seen.add(word);
  }
}

function main() {
  const messages = [];
  const allowSiteCollisions = process.argv.includes("--allow-site-collisions");
  validateGoldenZhuyin(messages);
  const draftPayload = readJson(draftPath);
  const previewWords = readJson(previewPath);
  const queuePayload = readJson(queuePath);
  const siteWords = readJson(siteWordsPath);
  const entries = Array.isArray(draftPayload.entries) ? draftPayload.entries : [];
  const queueEntries = Array.isArray(queuePayload.entries) ? queuePayload.entries : [];
  const expectedCount = queueEntries.filter((entry) => entry.action === "needs-review").length;
  if (entries.length !== expectedCount) {
    messages.push(`Draft count mismatch: ${entries.length} != ${expectedCount}`);
  }
  if (allowSiteCollisions) {
    const previewIds = new Set(previewWords.map((word) => String(word.id)));
    const missingPreviewIds = entries.filter((entry) => !previewIds.has(String(entry.id))).map((entry) => entry.id);
    if (missingPreviewIds.length > 0) {
      messages.push(`Preview is missing draft ids: ${missingPreviewIds.slice(0, 20).join(", ")}`);
    }
  } else {
    const expectedPreviewCount = siteWords.length + entries.length;
    if (previewWords.length !== expectedPreviewCount) {
      messages.push(`Preview count mismatch: ${previewWords.length} != ${expectedPreviewCount}`);
    }
  }
  validateUniqueIds(entries, siteWords, messages, allowSiteCollisions);
  validateNoDuplicateWords(entries, siteWords, messages, allowSiteCollisions);
  for (const entry of entries) {
    validateDraftEntry(entry, messages);
  }
  if (messages.length > 0) {
    console.log("FAILED");
    for (const message of messages.slice(0, 80)) {
      console.log(`- ${message}`);
    }
    if (messages.length > 80) {
      console.log(`- ... ${messages.length - 80} more`);
    }
    process.exit(1);
  }
  console.log("PASSED");
  console.log(`draft_entries=${entries.length}`);
  console.log(`preview_words=${previewWords.length}`);
}

main();
