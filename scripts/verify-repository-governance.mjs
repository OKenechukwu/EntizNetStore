import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function requireFile(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    fail(`Required repository-governance file missing: ${relativePath}`);
    return null;
  }
  return fs.readFileSync(absolute, "utf8");
}

const codeowners = requireFile(".github/CODEOWNERS");
const dependabot = requireFile(".github/dependabot.yml");
const protectionDoc = requireFile("docs/operations/MAIN_BRANCH_PROTECTION_GATE.md");
const supplyChainDoc = requireFile("docs/operations/REPOSITORY_SUPPLY_CHAIN.md");

if (codeowners) {
  for (const fragment of [
    "* @OKenechukwu",
    "/.github/ @OKenechukwu",
    "/supabase/migrations/ @OKenechukwu",
    "/app/api/ @OKenechukwu",
    "/scripts/ @OKenechukwu",
    "/docs/operations/ @OKenechukwu",
    "/LAUNCH_BLOCKERS.md @OKenechukwu",
  ]) {
    if (!codeowners.includes(fragment)) {
      fail(`CODEOWNERS lost required ownership boundary: ${fragment}`);
    }
  }
}

if (dependabot) {
  for (const fragment of [
    "version: 2",
    "package-ecosystem: npm",
    "package-ecosystem: github-actions",
    "interval: weekly",
    "timezone: Asia/Manila",
    "open-pull-requests-limit: 5",
  ]) {
    if (!dependabot.includes(fragment)) {
      fail(`Dependabot configuration lost required control: ${fragment}`);
    }
  }

  if (/open-pull-requests-limit:\s*(?:[6-9]|\d{2,})\b/.test(dependabot)) {
    fail("Dependabot pull-request concurrency must remain bounded at five or fewer per ecosystem");
  }
}

const requiredCheckContexts = [
  "verify",
  "database-reproduction",
  "dependency-audit",
  "http-authorization",
  "product-media-provenance",
  "image-egress",
];

if (protectionDoc) {
  for (const context of requiredCheckContexts) {
    if (!protectionDoc.includes(`\`${context}\``)) {
      fail(`Main-branch protection contract lost required check context: ${context}`);
    }
  }

  for (const phrase of [
    "Require changes to reach `main` through a pull request.",
    "Block force pushes to `main`.",
    "Block deletion of `main`.",
    "Apply enforcement to administrators/owners",
  ]) {
    if (!protectionDoc.includes(phrase)) {
      fail(`Main-branch protection contract lost required policy: ${phrase}`);
    }
  }
}

if (supplyChainDoc) {
  for (const phrase of [
    "CODEOWNERS",
    "Dependabot",
    "pull_request_target",
    "write-all",
    "main` remains unprotected",
  ]) {
    if (!supplyChainDoc.includes(phrase)) {
      fail(`Repository supply-chain runbook lost required guidance: ${phrase}`);
    }
  }
}

const workflowDir = path.join(root, ".github", "workflows");
const workflowNames = fs.existsSync(workflowDir)
  ? fs.readdirSync(workflowDir).filter((name) => /\.ya?ml$/.test(name))
  : [];

for (const name of workflowNames) {
  const relativePath = `.github/workflows/${name}`;
  const source = read(relativePath);

  if (/^\s*pull_request_target\s*:/m.test(source)) {
    fail(`${relativePath} must not use pull_request_target on this public repository`);
  }

  if (/^\s*permissions\s*:\s*write-all\s*$/m.test(source)) {
    fail(`${relativePath} must not grant write-all token permissions`);
  }

  if (/^\s*permissions\s*:\s*read-all\s*$/m.test(source)) {
    fail(`${relativePath} must declare only the permissions it actually needs, not read-all`);
  }
}

if (failures.length > 0) {
  console.error("Repository governance verification FAILED:\n");
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log(
  `Repository governance verification passed (${workflowNames.length} workflow files scanned; ${requiredCheckContexts.length} required check contexts frozen).`,
);
