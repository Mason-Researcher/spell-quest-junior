const {
  candidatePath,
  normalizeWord,
  readJson,
  siteWordsPath,
  validateCandidateEntry
} = require("./official_candidate_common");

const draftPath = require("path").join(
  require("path").resolve(__dirname, ".."),
  "data-imports",
  "official-word-bank",
  "official-word-bank.reviewed-draft.json"
);

function validateCounts(entries, draftEntries, messages) {
  if (entries.length !== draftEntries.length) {
    messages.push(`Candidate count mismatch: ${entries.length} != ${draftEntries.length}`);
  }
  const draftKeys = new Set(draftEntries.map((entry) => String(entry.sourceKey)));
  const candidateKeys = new Set(entries.map((entry) => String(entry.sourceKey)));
  for (const key of draftKeys) {
    if (!candidateKeys.has(key)) {
      messages.push(`Candidate missing sourceKey ${key}`);
    }
  }
}

function validateUniqueness(entries, siteWords, messages, allowSiteCollisions) {
  const ids = new Set();
  const words = new Set();
  const siteIds = new Set(siteWords.map((word) => String(word.id)));
  const siteWordSet = new Set(siteWords.map((word) => normalizeWord(word.word)));
  const siteById = new Map();
  for (const word of siteWords) {
    siteById.set(String(word.id), normalizeWord(word.word));
  }
  for (const entry of entries) {
    if (ids.has(entry.id)) {
      messages.push(`Duplicate candidate id: ${entry.id}`);
    }
    ids.add(entry.id);
    if (siteIds.has(entry.id)) {
      if (!allowSiteCollisions) {
        messages.push(`Candidate id collides with site id: ${entry.id}`);
      } else if (siteById.get(String(entry.id)) !== normalizeWord(entry.word)) {
        messages.push(`Candidate id collides with a different site word: ${entry.id}`);
      }
    }
    const word = normalizeWord(entry.word);
    if (words.has(word)) {
      messages.push(`Duplicate candidate word: ${entry.word}`);
    }
    words.add(word);
    if (siteWordSet.has(word) && !allowSiteCollisions) {
      messages.push(`Candidate word already exists in site words: ${entry.word}`);
    }
  }
}

function validateApprovalGate(entries, messages) {
  for (const entry of entries) {
    if (entry.reviewStatus === "approved") {
      messages.push(`${entry.id} must not be approved.`);
    }
    if (entry.contentReview && entry.contentReview.status === "approved") {
      messages.push(`${entry.id} contentReview must not be approved.`);
    }
    if (Array.isArray(entry.contexts)) {
      for (const context of entry.contexts) {
        if (context.reviewStatus === "approved") {
          messages.push(`${entry.id} context ${context.id} must not be approved.`);
        }
      }
    }
  }
}

function main() {
  const messages = [];
  const allowSiteCollisions = process.argv.includes("--allow-site-collisions");
  const candidatePayload = readJson(candidatePath);
  const draftPayload = readJson(draftPath);
  const siteWords = readJson(siteWordsPath);
  const entries = Array.isArray(candidatePayload.entries) ? candidatePayload.entries : [];
  const draftEntries = Array.isArray(draftPayload.entries) ? draftPayload.entries : [];
  validateCounts(entries, draftEntries, messages);
  validateUniqueness(entries, siteWords, messages, allowSiteCollisions);
  validateApprovalGate(entries, messages);
  for (const entry of entries) {
    validateCandidateEntry(entry, messages);
  }
  if (messages.length > 0) {
    console.log("FAILED");
    for (const message of messages.slice(0, 100)) {
      console.log(`- ${message}`);
    }
    if (messages.length > 100) {
      console.log(`- ... ${messages.length - 100} more`);
    }
    process.exit(1);
  }
  console.log("PASSED");
  console.log(`candidate_entries=${entries.length}`);
  console.log(`provider=${candidatePayload.metadata && candidatePayload.metadata.provider}`);
}

main();
