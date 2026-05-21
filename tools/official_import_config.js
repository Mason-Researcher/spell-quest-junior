const path = require("path");

const root = path.resolve(__dirname, "..");
const defaultSlug = "official-word-bank";

function readArg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index < 0 || index + 1 >= process.argv.length) {
    return fallback;
  }
  return process.argv[index + 1];
}

function valueFromArgOrEnv(argName, envName, fallback) {
  return readArg(argName, process.env[envName] || fallback);
}

function getImportConfig() {
  const slug = valueFromArgOrEnv("--import-slug", "WORD_BANK_IMPORT_SLUG", defaultSlug);
  const basename = valueFromArgOrEnv("--basename", "WORD_BANK_BASENAME", slug);
  const importRootText = valueFromArgOrEnv("--import-root", "WORD_BANK_IMPORT_ROOT", "");
  const importRoot = importRootText ? path.resolve(root, importRootText) : path.join(root, "data-imports", slug);
  const previewPrefix = slug === defaultSlug && basename === defaultSlug ? "official" : basename;
  return {
    basename,
    importRoot,
    root,
    slug,
    autoCandidatesPath: path.join(importRoot, `${basename}.auto-candidates.json`),
    autoCandidatesReportPath: path.join(importRoot, "auto-candidates-report.md"),
    providerRequestsPath: path.join(importRoot, `${basename}.provider-requests.jsonl`),
    rawPath: path.join(importRoot, `${basename}.raw.json`),
    reviewQueuePath: path.join(importRoot, `${basename}.review-queue.json`),
    reviewedDraftPath: path.join(importRoot, `${basename}.reviewed-draft.json`),
    reviewedDraftPreviewPath: path.join(importRoot, `words.${previewPrefix}-draft.preview.json`),
    reviewedDraftReportPath: path.join(importRoot, "reviewed-draft-report.md"),
    reviewedPath: path.join(importRoot, `${basename}.reviewed.json`),
    reviewedPreviewPath: path.join(importRoot, `${basename}.reviewed.preview.json`),
    mergedPreviewPath: path.join(importRoot, `words.${previewPrefix}-merged.preview.json`)
  };
}

module.exports = {
  getImportConfig,
  readArg,
  root
};
