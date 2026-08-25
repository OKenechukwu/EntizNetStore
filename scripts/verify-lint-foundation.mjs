import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

for (const forbiddenPath of [
  ".github/workflows/generate-eslint-baseline.yml",
  ".github/workflows/regenerate-lockfile.yml",
]) {
  if (exists(forbiddenPath)) {
    fail(`Temporary write-capable workflow must not exist: ${forbiddenPath}`);
  }
}

for (const requiredPath of [
  "eslint.config.mjs",
  "eslint-baseline.json",
  "scripts/lint-with-baseline.mjs",
  "docs/operations/LINT_QUALITY_BASELINE_2026-08-25.md",
]) {
  if (!exists(requiredPath)) fail(`Required lint-quality file missing: ${requiredPath}`);
}

const pkg = JSON.parse(read("package.json"));
if (pkg.scripts?.lint !== "node scripts/lint-with-baseline.mjs") {
  fail(`Canonical lint command drifted: ${pkg.scripts?.lint ?? "missing"}`);
}
if (pkg.scripts?.["lint:strict"] !== "eslint . --max-warnings=0") {
  fail(`Strict lint command drifted: ${pkg.scripts?.["lint:strict"] ?? "missing"}`);
}
if (/\bnext\s+lint\b/.test(JSON.stringify(pkg.scripts ?? {}))) {
  fail("Obsolete `next lint` command must not return");
}
if (pkg.devDependencies?.eslint !== "9.39.5") {
  fail(`ESLint compatibility pin drifted: ${pkg.devDependencies?.eslint ?? "missing"}`);
}

if (exists("eslint.config.mjs")) {
  const config = read("eslint.config.mjs");
  for (const requiredFragment of [
    'eslint-config-next/core-web-vitals',
    'eslint-config-next/typescript',
    'globalIgnores',
  ]) {
    if (!config.includes(requiredFragment)) {
      fail(`ESLint flat config lost required control: ${requiredFragment}`);
    }
  }
}

if (exists("scripts/lint-with-baseline.mjs")) {
  const script = read("scripts/lint-with-baseline.mjs");
  for (const requiredFragment of [
    'react-hooks/rules-of-hooks',
    'react-hooks/set-state-in-render',
    'message.fatal === true',
    'currentCount > allowed',
    'Refusing to generate a baseline',
  ]) {
    if (!script.includes(requiredFragment)) {
      fail(`Lint ratchet lost required hard-failure control: ${requiredFragment}`);
    }
  }
}

if (exists("eslint-baseline.json")) {
  let baseline;
  try {
    baseline = JSON.parse(read("eslint-baseline.json"));
  } catch {
    fail("ESLint baseline must be valid JSON");
  }

  if (baseline) {
    if (baseline.version !== 1) fail(`Unsupported ESLint baseline version: ${baseline.version}`);
    for (const field of ["total", "errors", "warnings"]) {
      if (!Number.isInteger(baseline[field]) || baseline[field] < 0) {
        fail(`ESLint baseline ${field} must be a non-negative integer`);
      }
    }
    if (!baseline.entries || typeof baseline.entries !== "object" || Array.isArray(baseline.entries)) {
      fail("ESLint baseline entries must be an object map");
    }
    if (baseline.total !== baseline.errors + baseline.warnings) {
      fail("ESLint baseline total must equal errors + warnings");
    }
  }
}

if (exists(".github/workflows/ci.yml")) {
  const ci = read(".github/workflows/ci.yml");
  if (!ci.includes("npm run lint")) {
    fail("CI verify job must execute the lint non-regression gate");
  }
}

if (failures.length > 0) {
  console.error("Lint-foundation verification FAILED:\n");
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log("Lint-foundation verification passed.");
