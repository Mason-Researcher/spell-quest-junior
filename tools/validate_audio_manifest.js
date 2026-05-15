const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const wordsPath = path.join(rootDir, "site", "data", "words.json");
const manifestPath = path.join(rootDir, "site", "data", "audio-manifest.json");
const profileIndex = process.argv.indexOf("--profile");
const profile = profileIndex >= 0 && process.argv[profileIndex + 1] ? process.argv[profileIndex + 1] : "word";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fail(message, details) {
  console.error(`FAILED audio_manifest=invalid ${message}`);
  if (details && details.length) {
    console.error(details.slice(0, 12).join("\n"));
  }
  process.exit(1);
}

const words = readJson(wordsPath);
const manifest = readJson(manifestPath);

if (!Array.isArray(words)) {
  fail("words_json_not_array");
}

if (!manifest || typeof manifest !== "object" || !manifest.clips || typeof manifest.clips !== "object") {
  fail("manifest_missing_clips");
}

const wordIds = new Set();
const duplicateIds = [];
for (const word of words) {
  if (!word || typeof word !== "object" || !word.id || !word.word) {
    fail("word_missing_id_or_text");
  }
  if (wordIds.has(word.id)) {
    duplicateIds.push(word.id);
  }
  wordIds.add(word.id);
}
if (duplicateIds.length) {
  fail("duplicate_word_ids", duplicateIds);
}

const staleIds = [];
for (const clipWordId of Object.keys(manifest.clips)) {
  if (!wordIds.has(clipWordId)) {
    staleIds.push(clipWordId);
  }
}
if (staleIds.length) {
  fail("stale_clip_ids", staleIds);
}

function hasApprovedLearningContent(word) {
  return Boolean(word && word.contentReview && word.contentReview.status === "approved");
}

function approvedContexts(word) {
  if (!hasApprovedLearningContent(word) || !Array.isArray(word.contexts)) {
    return [];
  }
  return word.contexts.filter((context) => {
    if (!context || context.reviewStatus !== "approved") {
      return false;
    }
    const requiredValues = [
      context.id,
      context.labelZh,
      context.labelZhuyin,
      context.sentence,
      context.sentenceZh,
      context.sentenceZhuyin,
      context.usageZh,
      context.usageZhuyin
    ];
    return requiredValues.every((value) => String(value || "").trim().length > 0);
  });
}

function expectedClipTypes(word) {
  if (profile === "word") {
    return ["word"];
  }
  if (profile !== "ui-all") {
    fail(`unsupported_profile=${profile}`);
  }
  const clipTypes = ["word", "example", "meaningZh", "topicZh", "exampleZh", "examHintZh"];
  const contexts = approvedContexts(word);
  if (contexts.length > 0) {
    for (const context of contexts) {
      clipTypes.push(`context-${context.id}-en`);
      clipTypes.push(`context-${context.id}-zh`);
    }
  } else {
    clipTypes.push("usage");
    clipTypes.push("usageZh");
  }
  return clipTypes;
}

const missing = [];
const badFiles = [];
let clipCount = 0;
let requiredClipCount = 0;
for (const word of words) {
  const wordClips = manifest.clips[word.id];
  const requiredClipTypes = expectedClipTypes(word);
  requiredClipCount += requiredClipTypes.length;
  for (const clipType of requiredClipTypes) {
    if (!wordClips || typeof wordClips !== "object" || !wordClips[clipType]) {
      missing.push(`${word.id}:${clipType}`);
      continue;
    }
    const clip = wordClips[clipType];
    const clipPath = clip && typeof clip === "object" ? clip.path : "";
    if (!clipPath || clipPath.startsWith("/") || clipPath.includes("..")) {
      badFiles.push(`${word.id}:${clipType}:bad-path`);
      continue;
    }
    const filePath = path.join(rootDir, "site", clipPath);
    if (!fs.existsSync(filePath)) {
      badFiles.push(`${word.id}:${clipType}:missing-file`);
      continue;
    }
    const size = fs.statSync(filePath).size;
    if (size <= 500) {
      badFiles.push(`${word.id}:${clipType}:small-file`);
      continue;
    }
    clipCount += 1;
  }
}

if (missing.length || badFiles.length) {
  fail(`missing=${missing.length} bad_files=${badFiles.length}`, missing.concat(badFiles));
}

console.log("PASSED audio_manifest=ok");
console.log(`profile=${profile}`);
console.log(`words=${words.length}`);
console.log(`required_clips=${requiredClipCount}`);
console.log(`clips=${clipCount}`);
