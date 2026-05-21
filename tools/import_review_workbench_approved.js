const childProcess = require("child_process");
const path = require("path");

const {
  importRoot,
  importBasename,
  readJson,
  root,
  writeJson
} = require("./official_candidate_common");

const officialReviewedPath = path.join(importRoot, `${importBasename}.reviewed.json`);
const previewPath = path.join(importRoot, `${importBasename}.reviewed.preview.json`);
const validatorPath = path.join(root, "tools", "validate_official_reviewed_entries.js");

function hasFlag(name) {
  return process.argv.includes(name);
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || index + 1 >= process.argv.length) {
    return "";
  }
  return process.argv[index + 1];
}

function fail(message) {
  console.log("FAILED");
  console.log(`- ${message}`);
  process.exit(1);
}

function runValidator(inputPath, minimum) {
  const args = [validatorPath, "--input", inputPath];
  if (minimum) {
    args.push("--min", String(minimum));
  }
  const result = childProcess.spawnSync("node", args, {
    cwd: root,
    encoding: "utf8"
  });
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function main() {
  const input = readArg("--input");
  if (!input) {
    fail("Missing --input downloaded approved JSON path.");
  }
  const inputPath = path.resolve(input);
  const minimumText = readArg("--min");
  const minimum = minimumText ? Number(minimumText) : 1;
  if (!Number.isInteger(minimum) || minimum < 0) {
    fail("--min must be a positive integer.");
  }
  const payload = readJson(inputPath);
  runValidator(inputPath, minimum);
  if (hasFlag("--apply")) {
    writeJson(officialReviewedPath, payload);
    runValidator(officialReviewedPath, minimum);
    console.log("IMPORTED");
    console.log(`target=${officialReviewedPath}`);
    return;
  }
  writeJson(previewPath, payload);
  runValidator(previewPath, minimum);
  console.log("PREVIEW_READY");
  console.log(`preview=${previewPath}`);
  console.log("Add --apply to replace official-word-bank.reviewed.json after manual approval.");
}

main();
