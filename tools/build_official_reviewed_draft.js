const fs = require("fs");
const path = require("path");

const {
  pairsFromTextAndZhuyin,
  zhuyinForChineseText
} = require("./zhuyin_utils");

const root = path.resolve(__dirname, "..");
const importRoot = path.join(root, "data-imports", "official-word-bank");
const queuePath = path.join(importRoot, "official-word-bank.review-queue.json");
const draftPath = path.join(importRoot, "official-word-bank.reviewed-draft.json");
const previewPath = path.join(importRoot, "words.official-draft.preview.json");
const reportPath = path.join(importRoot, "reviewed-draft-report.md");
const siteWordsPath = path.join(root, "site", "data", "words.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function nowIso() {
  return new Date().toISOString();
}

function buildExample(word) {
  return `I can spell ${word} during practice.`;
}

function buildUsage(word) {
  return `Use ${word} as a spelling word until a teacher-approved sentence is added.`;
}

function withZhuyinFields(candidate) {
  const zhuyin = zhuyinForChineseText(candidate.zh);
  const topicZhuyin = zhuyinForChineseText(candidate.topicZh);
  return {
    id: candidate.id,
    word: candidate.word,
    pos: candidate.pos,
    zh: candidate.zh,
    zhuyin,
    source: candidate.source,
    level: candidate.level,
    topic: candidate.topic,
    topicZh: candidate.topicZh,
    topicZhuyin,
    starred: candidate.starred,
    example: candidate.example || buildExample(candidate.word),
    usage: candidate.usage || buildUsage(candidate.word),
    reviewStatus: "needs_review",
    draftReview: {
      status: "needs_review",
      generatedAt: nowIso(),
      warning: "Technical draft only. Do not mark approved until spelling, meaning, zhuyin, example, and usage are reviewed."
    },
    zhPairs: pairsFromTextAndZhuyin(candidate.zh, zhuyin),
    topicZhPairs: pairsFromTextAndZhuyin(candidate.topicZh, topicZhuyin)
  };
}

function buildDraftEntries(queueEntries) {
  const entries = [];
  for (const item of queueEntries) {
    if (item.action !== "needs-review") {
      continue;
    }
    const entry = withZhuyinFields(item.candidate);
    entry.sourceKey = item.sourceKey;
    entry.sourceLetter = item.sourceLetter;
    entry.sourceNo = item.sourceNo;
    entry.zhAlternatives = item.candidate.zhAlternatives || [];
    entry.reviewChecklist = item.reviewChecklist || [];
    entries.push(entry);
  }
  return entries;
}

function buildReport(draftEntries, siteWords) {
  const byLetter = {};
  for (const entry of draftEntries) {
    const letter = entry.sourceLetter;
    byLetter[letter] = (byLetter[letter] || 0) + 1;
  }
  const lines = [
    "# Official Word Bank Reviewed Draft",
    "",
    fLine("Generated at", nowIso()),
    fLine("Existing site words", String(siteWords.length)),
    fLine("Draft entries", String(draftEntries.length)),
    fLine("Merged preview words", String(siteWords.length + draftEntries.length)),
    "",
    "## Counts By Letter",
    "",
    "| Letter | Needs review draft |",
    "| --- | ---: |"
  ];
  for (const letter of Object.keys(byLetter).sort()) {
    lines.push(`| ${letter} | ${byLetter[letter]} |`);
  }
  lines.push("");
  lines.push("## Merge Gate");
  lines.push("");
  lines.push("These entries remain `reviewStatus=needs_review`. The official merge script must continue to reject them until reviewed entries are explicitly approved.");
  return `${lines.join("\n")}\n`;
}

function fLine(label, value) {
  return `- ${label}: ${value}`;
}

function main() {
  const queue = readJson(queuePath);
  const siteWords = readJson(siteWordsPath);
  const queueEntries = Array.isArray(queue.entries) ? queue.entries : [];
  const draftEntries = buildDraftEntries(queueEntries);
  const payload = {
    metadata: {
      kind: "official-word-bank-reviewed-draft",
      status: "needs-review",
      generatedAt: nowIso(),
      sourceQueue: "official-word-bank.review-queue.json",
      draftEntryCount: draftEntries.length,
      mergePolicy: "Draft entries are website-shape candidates, not approved merge entries."
    },
    entries: draftEntries
  };
  writeJson(draftPath, payload);
  writeJson(previewPath, siteWords.concat(draftEntries));
  fs.writeFileSync(reportPath, buildReport(draftEntries, siteWords), "utf8");
  console.log("PASSED");
  console.log(`draft=${draftPath}`);
  console.log(`preview=${previewPath}`);
  console.log(`report=${reportPath}`);
  console.log(`draft_entries=${draftEntries.length}`);
  console.log(`preview_words=${siteWords.length + draftEntries.length}`);
}

main();
