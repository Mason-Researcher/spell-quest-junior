const fs = require("fs");

const {
  addGeneratedChineseFields,
  cloneBaseCandidate
} = require("../official_candidate_common");

function parseJsonLines(filePath) {
  const rows = [];
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    rows.push(JSON.parse(trimmed));
  }
  return rows;
}

function rowsBySourceKey(filePath) {
  const rows = parseJsonLines(filePath);
  const mapped = new Map();
  for (const row of rows) {
    if (!row.sourceKey) {
      throw new Error("JSONL provider row missing sourceKey.");
    }
    mapped.set(String(row.sourceKey), row);
  }
  return mapped;
}

function copyContext(context) {
  return {
    id: context.id,
    level: "grade-2-friendly",
    labelZh: context.labelZh,
    sentence: context.sentence,
    sentenceZh: context.sentenceZh,
    usageZh: context.usageZh,
    sourceBasis: Array.isArray(context.sourceBasis) ? context.sourceBasis : ["external-provider"],
    reviewStatus: "machine_candidate"
  };
}

function buildJsonlCandidate(draftEntry, providerRow, providerName) {
  const entry = cloneBaseCandidate(draftEntry);
  entry.example = providerRow.example;
  entry.exampleZh = providerRow.exampleZh;
  entry.usage = providerRow.usage;
  entry.reviewStatus = "machine_candidate";
  entry.contentReview = {
    status: "machine_candidate",
    generatedAt: new Date().toISOString(),
    provider: providerName,
    sourceRefs: Array.isArray(providerRow.sourceRefs) ? providerRow.sourceRefs : [
      {
        label: "External JSONL provider",
        url: `local:${draftEntry.sourceKey}`
      }
    ],
    basis: [
      "official-raw-transcription",
      "external-jsonl-provider",
      "machine-candidate-not-approved"
    ]
  };
  if (!Array.isArray(providerRow.contexts) || providerRow.contexts.length < 3) {
    throw new Error(`${draftEntry.sourceKey} JSONL provider contexts must include at least 3 items.`);
  }
  entry.contexts = providerRow.contexts.slice(0, 3).map((context) => copyContext(context));
  entry.autoQuality = {
    status: "ready_for_review",
    score: typeof providerRow.score === "number" ? providerRow.score : 0.9,
    provider: providerName,
    checks: [
      "external-provider-output",
      "word-in-example",
      "grade-2-sentence-length",
      "traditional-chinese-provided",
      "bopomofo-generated",
      "not-approved"
    ],
    limitations: [
      "External provider output still requires final human approval."
    ]
  };
  addGeneratedChineseFields(entry);
  return entry;
}

function buildCandidates(draftEntries, options) {
  if (!options || !options.input) {
    throw new Error("jsonl provider requires --input <file>.");
  }
  const providerName = options.providerName || "jsonl";
  const mapped = rowsBySourceKey(options.input);
  const entries = [];
  for (const draftEntry of draftEntries) {
    const row = mapped.get(String(draftEntry.sourceKey));
    if (!row) {
      throw new Error(`${draftEntry.sourceKey} missing provider JSONL row.`);
    }
    entries.push(buildJsonlCandidate(draftEntry, row, providerName));
  }
  return entries;
}

module.exports = {
  buildCandidates,
  providerName: "jsonl"
};
