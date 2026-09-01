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

const ACTION_PINS = new Map([
  ["actions/checkout", new Set(["3d3c42e5aac5ba805825da76410c181273ba90b1"])],
  ["actions/setup-node", new Set(["820762786026740c76f36085b0efc47a31fe5020"])],
  ["actions/github-script", new Set(["3a2844b7e9c422d3c10d287c895573f7108da1b3"])],
  [
    "actions/upload-artifact",
    new Set([
      "ea165f8d65b6e75b540449e92b4886f43607fa02",
      "043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
    ]),
  ],
  ["supabase/setup-cli", new Set(["ab058987d8d6c725971f6cf9d0b5c98467e30bd1"])],
]);

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

  if (/open-pull-requests-limit:\s*0\b/.test(dependabot)) {
    fail("Routine Dependabot patch/minor surveillance must remain enabled during launch hardening");
  }

  const ecosystemBlocks = dependabot
    .split(/\n(?=\s*- package-ecosystem:)/)
    .filter((block) => /package-ecosystem:/.test(block));

  for (const ecosystem of ["npm", "github-actions"]) {
    const block = ecosystemBlocks.find((candidate) =>
      new RegExp(`package-ecosystem:\\s*["']?${ecosystem.replace("-", "\\-")}["']?\\s*$`, "m").test(candidate),
    );
    if (!block) {
      fail(`Dependabot configuration lost ${ecosystem} update block`);
      continue;
    }

    for (const fragment of [
      "ignore:",
      'dependency-name: "*"',
      'update-types: ["version-update:semver-major"]',
    ]) {
      if (!block.includes(fragment)) {
        fail(`Dependabot ${ecosystem} block must suppress routine major version updates: ${fragment}`);
      }
    }
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
    "full 40-character commit SHA",
    "persist-credentials: false",
    "workflow_dispatch inputs",
    "Routine major-version version updates are suppressed",
    "security updates are not treated as routine version-update majors",
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

function verifyRunBlocks(relativePath, source) {
  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const inlineRun = line.match(/^(\s*)run:\s*(.+)$/);
    if (inlineRun && !/[|>]\s*$/.test(inlineRun[2])) {
      if (inlineRun[2].includes("${{ inputs.")) {
        fail(`${relativePath}:${index + 1} must route workflow_dispatch inputs through env before shell execution`);
      }
      if (inlineRun[2].includes("${{ secrets.")) {
        fail(`${relativePath}:${index + 1} must route secrets through env before shell execution`);
      }
      continue;
    }

    const blockRun = line.match(/^(\s*)run:\s*[|>]\s*$/);
    if (!blockRun) continue;

    const runIndent = blockRun[1].length;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const candidate = lines[cursor];
      if (candidate.trim() === "") continue;
      const candidateIndent = candidate.match(/^\s*/)?.[0].length ?? 0;
      if (candidateIndent <= runIndent) break;
      if (candidate.includes("${{ inputs.")) {
        fail(`${relativePath}:${cursor + 1} must route workflow_dispatch inputs through env before shell execution`);
      }
      if (candidate.includes("${{ secrets.")) {
        fail(`${relativePath}:${cursor + 1} must route secrets through env before shell execution`);
      }
    }
  }
}

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

  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/);
    if (!match) continue;

    const reference = match[1];
    if (reference.startsWith("./")) continue;

    const at = reference.lastIndexOf("@");
    if (at <= 0) {
      fail(`${relativePath}:${index + 1} has malformed remote Action reference: ${reference}`);
      continue;
    }

    const action = reference.slice(0, at);
    const pin = reference.slice(at + 1);
    if (!/^[0-9a-f]{40}$/.test(pin)) {
      fail(`${relativePath}:${index + 1} remote Action must use a full 40-character commit SHA: ${reference}`);
      continue;
    }

    const allowedPins = ACTION_PINS.get(action);
    if (!allowedPins) {
      fail(`${relativePath}:${index + 1} uses unapproved remote Action package: ${action}`);
      continue;
    }
    if (!allowedPins.has(pin)) {
      fail(`${relativePath}:${index + 1} uses an unreviewed commit for ${action}: ${pin}`);
    }

    if (action === "actions/checkout") {
      const lookahead = lines.slice(index + 1, index + 8).join("\n");
      if (!/persist-credentials:\s*false\b/.test(lookahead)) {
        fail(`${relativePath}:${index + 1} checkout must set persist-credentials: false`);
      }
    }
  }

  verifyRunBlocks(relativePath, source);
}

if (failures.length > 0) {
  console.error("Repository governance verification FAILED:\n");
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log(
  `Repository governance verification passed (${workflowNames.length} workflow files scanned; ${requiredCheckContexts.length} required check contexts frozen; ${ACTION_PINS.size} approved Action packages pinned; routine major version updates suppressed).`,
);
