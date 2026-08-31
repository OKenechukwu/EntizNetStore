import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workflowRoot = path.join(root, ".github", "workflows");
const failures = [];

function fail(message) {
  failures.push(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

const requiredWorkflows = [
  ".github/workflows/ci.yml",
  ".github/workflows/http-authorization.yml",
  ".github/workflows/production-monitor.yml",
  ".github/workflows/production-backup.yml",
  ".github/workflows/restore-rehearsal.yml",
];

for (const workflow of requiredWorkflows) {
  if (!exists(workflow)) fail(`Required workflow missing: ${workflow}`);
}

if (exists(".github/workflows/lockfile-sync.yml")) {
  fail("Obsolete write-capable lockfile-sync workflow must not exist");
}

const workflowFiles = fs.existsSync(workflowRoot)
  ? fs
      .readdirSync(workflowRoot)
      .filter((name) => /\.ya?ml$/.test(name))
      .map((name) => `.github/workflows/${name}`)
  : [];

const deprecatedActionPatterns = [
  {
    label: "actions/checkout older than v7",
    regex: /actions\/checkout@v([1-6])\b/g,
  },
  {
    label: "actions/setup-node older than v7",
    regex: /actions\/setup-node@v([1-6])\b/g,
  },
  {
    label: "actions/github-script older than v9",
    regex: /actions\/github-script@v([1-8])\b/g,
  },
];

for (const workflow of workflowFiles) {
  const source = read(workflow);
  for (const { label, regex } of deprecatedActionPatterns) {
    regex.lastIndex = 0;
    if (regex.test(source)) fail(`${label} found in ${workflow}`);
  }
}

for (const workflow of [
  ".github/workflows/ci.yml",
  ".github/workflows/http-authorization.yml",
  ".github/workflows/production-backup.yml",
  ".github/workflows/restore-rehearsal.yml",
]) {
  if (!exists(workflow)) continue;
  const source = read(workflow);
  if (!source.includes("actions/checkout@v7")) {
    fail(`${workflow} must use actions/checkout@v7`);
  }
  if (!source.includes("actions/setup-node@v7")) {
    fail(`${workflow} must use actions/setup-node@v7`);
  }
  if (!/node-version:\s*22\b/.test(source)) {
    fail(`${workflow} must keep application jobs on canonical Node.js 22`);
  }
}

if (exists(".github/workflows/production-monitor.yml")) {
  const monitor = read(".github/workflows/production-monitor.yml");
  for (const fragment of [
    "actions/checkout@v7",
    "actions/setup-node@v7",
    "actions/github-script@v9",
    "persist-credentials: false",
    "node-version: 22",
  ]) {
    if (!monitor.includes(fragment)) {
      fail(`Production monitor lost required Actions/runtime control: ${fragment}`);
    }
  }
}

if (failures.length > 0) {
  console.error("GitHub Actions foundation verification FAILED:\n");
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log(
  `GitHub Actions foundation verification passed (${workflowFiles.length} workflow files scanned).`,
);
