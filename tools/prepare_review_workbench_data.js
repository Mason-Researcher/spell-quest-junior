const fs = require("fs");
const path = require("path");

const {
  candidatePath,
  importBasename,
  normalizeWord,
  readJson,
  root,
  siteWordsPath,
  validateCandidateEntry,
  writeJson
} = require("./official_candidate_common");

const reviewDataDir = path.join(root, "site", "data", "review");
const workbenchCandidateFile = `${importBasename}.auto-candidates.json`;
const workbenchCandidatePath = path.join(reviewDataDir, workbenchCandidateFile);
const manifestPath = path.join(reviewDataDir, "review-workbench-manifest.json");

function collectLetters(entries) {
  const letters = new Set();
  for (const entry of entries) {
    if (entry.sourceLetter) {
      letters.add(String(entry.sourceLetter));
    }
  }
  return Array.from(letters).sort();
}

function validateCandidatePayload(payload, messages) {
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  if (entries.length === 0) {
    messages.push("No machine candidates found.");
    return entries;
  }
  const siteWords = readJson(siteWordsPath);
  const siteWordSet = new Set(siteWords.map((word) => normalizeWord(word.word)));
  const seenIds = new Set();
  const seenWords = new Set();
  for (const entry of entries) {
    validateCandidateEntry(entry, messages);
    if (seenIds.has(entry.id)) {
      messages.push(`Duplicate candidate id: ${entry.id}`);
    }
    seenIds.add(entry.id);
    const word = normalizeWord(entry.word);
    if (seenWords.has(word)) {
      messages.push(`Duplicate candidate word: ${entry.word}`);
    }
    seenWords.add(word);
    if (siteWordSet.has(word)) {
      messages.push(`Candidate word already exists in site words: ${entry.word}`);
    }
  }
  return entries;
}

function main() {
  const messages = [];
  const payload = readJson(candidatePath);
  const entries = validateCandidatePayload(payload, messages);
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
  fs.mkdirSync(reviewDataDir, { recursive: true });
  const preparedPayload = {
    metadata: {
      ...payload.metadata,
      preparedAt: new Date().toISOString(),
      preparedFor: "local-review-workbench",
      localOnly: true
    },
    entries
  };
  writeJson(workbenchCandidatePath, preparedPayload);
  writeJson(manifestPath, {
    kind: "review-workbench-manifest",
    generatedAt: new Date().toISOString(),
    localOnly: true,
    source: path.relative(root, candidatePath).split(path.sep).join("/"),
    candidateData: `data/review/${workbenchCandidateFile}`,
    candidateCount: entries.length,
    letters: collectLetters(entries)
  });
  console.log("PASSED");
  console.log(`candidate_count=${entries.length}`);
  console.log(`workbench_data=${workbenchCandidatePath}`);
  console.log(`manifest=${manifestPath}`);
}

main();
