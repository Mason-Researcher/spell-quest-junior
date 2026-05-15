const fs = require("fs");
const path = require("path");

const {
  candidatePath,
  candidateReportPath,
  draftPath,
  providerRequestPath,
  readJson,
  root,
  siteWordsPath,
  writeJson,
  writeText
} = require("./official_candidate_common");

function parseArgs(argv) {
  const options = {
    provider: "template",
    input: "",
    writeProviderRequests: false
  };
  for (let index = 2; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--provider" && index + 1 < argv.length) {
      options.provider = argv[index + 1];
      index += 1;
    } else if (item === "--input" && index + 1 < argv.length) {
      options.input = argv[index + 1];
      index += 1;
    } else if (item === "--write-provider-requests") {
      options.writeProviderRequests = true;
    }
  }
  return options;
}

function loadProvider(name) {
  if (name === "template") {
    return require("./candidate_providers/template_provider");
  }
  if (name === "jsonl" || name === "llm-jsonl" || name === "google-jsonl") {
    return require("./candidate_providers/jsonl_provider");
  }
  throw new Error(`Unsupported provider: ${name}`);
}

function buildRequestRow(entry) {
  return {
    sourceKey: entry.sourceKey,
    word: entry.word,
    pos: entry.pos,
    zh: entry.zh,
    zhAlternatives: entry.zhAlternatives || [],
    level: entry.level,
    topic: entry.topic,
    topicZh: entry.topicZh,
    instruction: "Generate grade-2-friendly spelling bee learning content. Return JSON with example, exampleZh, usage, and exactly 3 contexts. Each English sentence must include the exact target word. Keep English sentences simple, 5-14 words. Keep Traditional Chinese natural for Taiwan children. Do not mark approved.",
    requiredJsonShape: {
      sourceKey: entry.sourceKey,
      example: "",
      exampleZh: "",
      usage: "",
      contexts: [
        {
          id: "school",
          labelZh: "",
          sentence: "",
          sentenceZh: "",
          usageZh: "",
          sourceBasis: []
        },
        {
          id: "home",
          labelZh: "",
          sentence: "",
          sentenceZh: "",
          usageZh: "",
          sourceBasis: []
        },
        {
          id: "quiz",
          labelZh: "",
          sentence: "",
          sentenceZh: "",
          usageZh: "",
          sourceBasis: []
        }
      ],
      score: 0.9
    }
  };
}

function writeProviderRequests(entries) {
  const lines = [];
  for (const entry of entries) {
    lines.push(JSON.stringify(buildRequestRow(entry)));
  }
  writeText(providerRequestPath, `${lines.join("\n")}\n`);
}

function countByLetter(entries) {
  const counts = {};
  for (const entry of entries) {
    counts[entry.sourceLetter] = (counts[entry.sourceLetter] || 0) + 1;
  }
  return counts;
}

function buildReport(provider, entries, siteWords) {
  const counts = countByLetter(entries);
  const lines = [
    "# Official Word Bank Auto Candidates",
    "",
    `- Generated at: ${new Date().toISOString()}`,
    `- Provider: ${provider}`,
    `- Existing site words: ${siteWords.length}`,
    `- Candidate entries: ${entries.length}`,
    "",
    "## Counts By Letter",
    "",
    "| Letter | Machine candidates |",
    "| --- | ---: |"
  ];
  for (const letter of Object.keys(counts).sort()) {
    lines.push(`| ${letter} | ${counts[letter]} |`);
  }
  lines.push("");
  lines.push("## Approval Policy");
  lines.push("");
  lines.push("All generated entries are `machine_candidate`. They are not approved and must not be merged into `site/data/words.json` until reviewed.");
  return `${lines.join("\n")}\n`;
}

function main() {
  const options = parseArgs(process.argv);
  const draftPayload = readJson(draftPath);
  const siteWords = readJson(siteWordsPath);
  const draftEntries = Array.isArray(draftPayload.entries) ? draftPayload.entries : [];
  if (options.writeProviderRequests) {
    writeProviderRequests(draftEntries);
  }
  const provider = loadProvider(options.provider);
  const candidates = provider.buildCandidates(draftEntries, {
    input: options.input ? path.resolve(root, options.input) : "",
    providerName: options.provider
  });
  const payload = {
    metadata: {
      kind: "official-word-bank-auto-candidates",
      status: "machine-candidate",
      generatedAt: new Date().toISOString(),
      provider: options.provider,
      sourceDraft: "official-word-bank.reviewed-draft.json",
      candidateCount: candidates.length,
      approvalPolicy: "Generated candidates must remain machine_candidate until reviewed."
    },
    entries: candidates
  };
  writeJson(candidatePath, payload);
  writeText(candidateReportPath, buildReport(options.provider, candidates, siteWords));
  console.log("PASSED");
  console.log(`provider=${options.provider}`);
  console.log(`candidates=${candidatePath}`);
  console.log(`report=${candidateReportPath}`);
  if (options.writeProviderRequests) {
    console.log(`provider_requests=${providerRequestPath}`);
  }
  console.log(`candidate_entries=${candidates.length}`);
}

main();
