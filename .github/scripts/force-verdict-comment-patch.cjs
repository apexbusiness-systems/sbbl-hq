/**
 * Patches stream-validation-prelive.yml to insert a PR verdict comment step
 * before the "Upload stream-validation artifacts" step — if not already present.
 */
const fs = require("fs");

const targetPath = ".github/workflows/stream-validation-prelive.yml";

let content;
try {
  content = fs.readFileSync(targetPath, "utf8");
} catch (err) {
  console.error(`Cannot read ${targetPath}: ${err.message}`);
  process.exit(1);
}

if (content.includes("Post validation verdict comment")) {
  console.log("Verdict comment step already present — no patch needed.");
  process.exit(0);