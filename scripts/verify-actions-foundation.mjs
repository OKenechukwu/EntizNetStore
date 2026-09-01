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

const pins = {
  checkout: "3d3c42e5aac5ba805825da76410c181273ba90b1",
  setupNode: "820762786026740c76f36085b0efc47a31fe5020",
  githubScript: "3a2844b7e9c422d3c10d287c895573f7108da1b3",
  uploadArtifactV4: "ea165f8d65b6e75b540449e92b4886f43607fa02",
  uploadArtifactV7: "043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
  supabaseCli: "ab058987d8d6c725971f6cf9d0b5c98467e30bd1",
};

const requiredWorkflows = [
  ".github/workflows/ci.yml",
  ".github/workflows/deployed-authorization.yml",
  ".github/workflows/http-authorization.yml",
  ".github/workflows/image-egress.yml",
  ".github/workflows/product-media-authority.yml",
  ".github/workflows/production-monitor.yml",
  ".github/workflows/production-backup.yml",
  ".github/workflows/restore-rehearsal.yml",
  ".github/workflows/production-capacity.yml",
];

for (const workflow of requiredWorkflows) {
  if (!exists(workflow)) fail(`Required workflow missing: ${workflow}`);
}

const requiredPaymentReconciliationFiles = [
  "supabase/migrations/20260901011000_p0_payment_reconciliation_health.sql",
  "scripts/test-payment-reconciliation-health.sql",
  "scripts/test-payment-initialization-concurrency.sh",
  "app/api/health/route.ts",
];

for (const file of requiredPaymentReconciliationFiles) {
  if (!exists(file)) fail(`Payment reconciliation release guard missing: ${file}`);
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

function requireFragments(workflow, fragments) {
  if (!exists(workflow)) return;
  const source = read(workflow);
  for (const fragment of fragments) {
    if (!source.includes(fragment)) {
      fail(`${workflow} lost required Actions/runtime control: ${fragment}`);
    }
  }
}

const checkoutRef = `actions/checkout@${pins.checkout}`;
const setupNodeRef = `actions/setup-node@${pins.setupNode}`;
const supabaseRef = `supabase/setup-cli@${pins.supabaseCli}`;

requireFragments(".github/workflows/ci.yml", [
  checkoutRef,
  setupNodeRef,
  supabaseRef,
  "persist-credentials: false",
  "node-version: 22",
]);

requireFragments(".github/workflows/http-authorization.yml", [
  checkoutRef,
  setupNodeRef,
  supabaseRef,
  `actions/upload-artifact@${pins.uploadArtifactV4}`,
  "persist-credentials: false",
  "node-version: 22",
]);

requireFragments(".github/workflows/image-egress.yml", [
  checkoutRef,
  setupNodeRef,
  "persist-credentials: false",
  "node-version: 22",
]);

requireFragments(".github/workflows/product-media-authority.yml", [
  checkoutRef,
  supabaseRef,
  "persist-credentials: false",
]);

requireFragments(".github/workflows/deployed-authorization.yml", [
  checkoutRef,
  setupNodeRef,
  `actions/upload-artifact@${pins.uploadArtifactV7}`,
  "persist-credentials: false",
  "ref: ${{ inputs.expected_commit }}",
  "node-version: 22",
]);

requireFragments(".github/workflows/production-backup.yml", [
  checkoutRef,
  setupNodeRef,
  supabaseRef,
  "persist-credentials: false",
  "node-version: 22",
]);

requireFragments(".github/workflows/restore-rehearsal.yml", [
  checkoutRef,
  setupNodeRef,
  "persist-credentials: false",
  "node-version: 22",
]);

if (exists(".github/workflows/production-monitor.yml")) {
  const monitor = read(".github/workflows/production-monitor.yml");
  for (const fragment of [
    checkoutRef,
    setupNodeRef,
    `actions/github-script@${pins.githubScript}`,
    "persist-credentials: false",
    "node-version: 22",
    "if: github.ref == 'refs/heads/main'",
    "ENTIZNETSTORE_EXPECTED_SHA: ${{ github.sha }}",
    "deployment-convergence retry",
    "for attempt in 1 2 3 4 5",
    "cron: '*/15 * * * *'",
  ]) {
    if (!monitor.includes(fragment)) {
      fail(`Production monitor lost required Actions/runtime control: ${fragment}`);
    }
  }
}

if (exists(".github/workflows/production-capacity.yml")) {
  const capacity = read(".github/workflows/production-capacity.yml");
  for (const fragment of [
    checkoutRef,
    setupNodeRef,
    "workflow_dispatch:",
    "RUN_READ_ONLY_CAPACITY_GATE",
    "CAPACITY_CONFIRMATION: ${{ inputs.confirmation }}",
    "persist-credentials: false",
    "if: github.ref == 'refs/heads/main'",
    "CAPACITY_EXPECTED_ORIGIN: https://entiznetstore.vercel.app",
    "CAPACITY_EXPECTED_SHA: ${{ github.sha }}",
    "node scripts/test-production-read-capacity.mjs",
  ]) {
    if (!capacity.includes(fragment)) {
      fail(`Production capacity workflow lost safety control: ${fragment}`);
    }
  }
  if (/\bschedule\s*:/.test(capacity) || /\bpush\s*:/.test(capacity) || /\bpull_request\s*:/.test(capacity)) {
    fail("Production capacity workflow must remain manual-only");
  }
}

if (exists("scripts/test-production-http-smoke.mjs")) {
  const smoke = read("scripts/test-production-http-smoke.mjs");
  for (const fragment of [
    "ENTIZNETSTORE_EXPECTED_SHA",
    "production deployment drift",
    "expectedVersion",
    "launchGates?.uploadSafety",
    "body?.checks?.payments !== 'ok'",
  ]) {
    if (!smoke.includes(fragment)) {
      fail(`Production smoke lost release/readiness control: ${fragment}`);
    }
  }
}

if (exists("app/api/health/route.ts")) {
  const healthRoute = read("app/api/health/route.ts");
  for (const fragment of [
    "service_payment_reconciliation_health",
    "p_stale_minutes: 10",
    "payments === 'ok'",
    "const checks = { database, storage, operations, payments }",
  ]) {
    if (!healthRoute.includes(fragment)) {
      fail(`Public readiness route lost payment reconciliation guard: ${fragment}`);
    }
  }
}

if (exists("scripts/test-payment-initialization-concurrency.sh")) {
  const paymentAuthority = read("scripts/test-payment-initialization-concurrency.sh");
  if (!paymentAuthority.includes("scripts/test-payment-reconciliation-health.sql")) {
    fail("Payment authority CI lane no longer executes reconciliation health regression");
  }
}

if (exists("scripts/test-payment-reconciliation-health.sql")) {
  const paymentHealth = read("scripts/test-payment-reconciliation-health.sql");
  for (const fragment of [
    "service_payment_reconciliation_health(integer)",
    "payment_initialization_uncertain",
    "stale_unbound_claim_count",
    "has_function_privilege('authenticated'",
    "search_path=pg_catalog, public",
  ]) {
    if (!paymentHealth.includes(fragment)) {
      fail(`Payment reconciliation regression lost required invariant: ${fragment}`);
    }
  }
}

if (exists("scripts/test-production-read-capacity.mjs")) {
  const capacityProbe = read("scripts/test-production-read-capacity.mjs");
  for (const fragment of [
    "CAPACITY_EXPECTED_ORIGIN",
    "CAPACITY_EXPECTED_SHA",
    "deployment_version_mismatch",
    "const paths = ['/', '/api/health']",
    "boundedInteger('CAPACITY_CONCURRENCY', 4, 1, 25)",
    "boundedInteger('CAPACITY_REQUESTS_PER_PATH', 20, 1, 250)",
  ]) {
    if (!capacityProbe.includes(fragment)) {
      fail(`Production capacity probe lost safety control: ${fragment}`);
    }
  }
}

if (failures.length > 0) {
  console.error("GitHub Actions foundation verification FAILED:\n");
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log(
  `GitHub Actions foundation verification passed (${workflowFiles.length} workflow files scanned; immutable action pins verified).`,
);
