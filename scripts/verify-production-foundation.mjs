import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const canonicalNodeEngine = ">=22 <23";

function fail(message) {
  failures.push(message);
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function walk(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [relativePath];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const next = path.join(relativePath, entry.name);
    return entry.isDirectory() ? walk(next) : [next];
  });
}

function stripComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const forbiddenPaths = [
  ".replit",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "bun.lockb",
  "app/_debug-routes/page.tsx",
  "app/api/hello/route.ts",
  "app/api/i18n/auto/route.ts",
  "app/api/i18n/key/route.ts",
  "app/api/i18n/seed-all/route.ts",
  "app/api/i18n/test/route.ts",
  "app/api/translate/route.ts",
  "app/dev",
  "lib/i18n/deepl.ts",
  "lib/i18n/store.ts",
  "lib/i18n/translate.ts",
];

for (const relativePath of forbiddenPaths) {
  if (exists(relativePath)) fail(`Forbidden production residue exists: ${relativePath}`);
}

const runtimeRoots = ["app", "components", "lib", "middleware.ts", "next.config.js", "next.config.mjs", "next.config.ts"];
const runtimeFiles = runtimeRoots.flatMap((relativePath) => walk(relativePath));
const forbiddenRuntimePatterns = [
  { label: "Replit", regex: /\breplit\b/i },
  { label: "Neon", regex: /\bneon\b/i },
  { label: "Helium", regex: /\bhelium\b/i },
  { label: "legacy DATABASE_URL", regex: /\bDATABASE_URL\b/ },
  { label: "legacy PGHOST", regex: /\bPGHOST\b/ },
  { label: "legacy PGDATABASE", regex: /\bPGDATABASE\b/ },
  { label: "legacy PGUSER", regex: /\bPGUSER\b/ },
  { label: "legacy PGPASSWORD", regex: /\bPGPASSWORD\b/ },
  { label: "legacy SUPABASE_SERVICE_ROLE", regex: /\bSUPABASE_SERVICE_ROLE\b(?!_KEY)/ },
];

for (const relativePath of runtimeFiles) {
  if (!/\.(?:[cm]?[jt]sx?|json)$/.test(relativePath)) continue;
  const executableContent = stripComments(read(relativePath));
  for (const { label, regex } of forbiddenRuntimePatterns) {
    if (regex.test(executableContent)) fail(`${label} runtime assumption found in ${relativePath}`);
  }
}

const forbiddenApiRouteSegments = new Set([
  "debug",
  "dev",
  "fixture",
  "fixtures",
  "maintenance",
  "migrate",
  "migration",
  "migrations",
  "mock",
  "mocks",
  "seed",
  "seeds",
  "test",
  "tests",
]);
const apiRouteFiles = walk("app/api").filter((relativePath) => /(?:^|[\\/])route\.[cm]?[jt]sx?$/.test(relativePath));

for (const relativePath of apiRouteFiles) {
  const normalizedPath = relativePath.split(path.sep).join("/");
  const routeSegments = normalizedPath.split("/").slice(2, -1);
  for (const segment of routeSegments) {
    const normalizedSegment = segment.replace(/^\((.*)\)$/, "$1").toLowerCase();
    if (forbiddenApiRouteSegments.has(normalizedSegment)) {
      fail(`Forbidden public API route segment '${segment}' found in ${normalizedPath}`);
    }
  }

  const executableContent = stripComments(read(relativePath));
  if (/\bconsole\.(?:log|debug|info|trace)\s*\(/.test(executableContent)) {
    fail(`Unstructured verbose console logging found in production API route: ${normalizedPath}`);
  }
}

const pkg = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));
const lockRoot = lock.packages?.[""] ?? {};

if (!/^npm@/.test(pkg.packageManager ?? "")) {
  fail(`Canonical packageManager must be npm, found: ${pkg.packageManager ?? "missing"}`);
}

if (pkg.engines?.node !== canonicalNodeEngine) {
  fail(`Canonical Node.js runtime contract must be ${canonicalNodeEngine}, found: ${pkg.engines?.node ?? "missing"}`);
}

if (lockRoot.engines?.node !== canonicalNodeEngine) {
  fail(`package-lock Node.js runtime contract must be ${canonicalNodeEngine}, found: ${lockRoot.engines?.node ?? "missing"}`);
}

if (lock.name !== pkg.name || lockRoot.name !== pkg.name) {
  fail(`Lockfile package name drift: package=${pkg.name}, lock=${lock.name}, lockRoot=${lockRoot.name}`);
}

function sortedKeys(value) {
  return Object.keys(value ?? {}).sort();
}

for (const field of ["dependencies", "devDependencies"]) {
  const packageKeys = sortedKeys(pkg[field]);
  const lockKeys = sortedKeys(lockRoot[field]);
  if (JSON.stringify(packageKeys) !== JSON.stringify(lockKeys)) {
    fail(`package-lock root ${field} does not match package.json`);
  }
}

const forbiddenPackages = [
  "@google-cloud/storage",
  "@supabase/auth-helpers-nextjs",
  "@uppy/aws-s3",
  "@uppy/core",
  "@uppy/dashboard",
  "@uppy/react",
  "pg",
  "@types/express",
  "@types/pg",
];

for (const packageName of forbiddenPackages) {
  if (pkg.dependencies?.[packageName] || pkg.devDependencies?.[packageName]) {
    fail(`Forbidden legacy direct dependency remains: ${packageName}`);
  }
  if (lock.packages?.[`node_modules/${packageName}`]) {
    fail(`Forbidden legacy package remains in package-lock: ${packageName}`);
  }
}

for (const requiredPath of [
  ".env.example",
  ".github/workflows/http-authorization.yml",
  ".github/workflows/production-monitor.yml",
  "LAUNCH_BLOCKERS.md",
  "app/api/health/route.ts",
  "docs/architecture/ADR-0001-account-capabilities.md",
  "docs/operations/BACKUP_RECOVERY.md",
  "docs/operations/DEPLOYMENT_RUNTIME_SECURITY_VERIFICATION_2026-08-25.md",
  "docs/operations/ENVIRONMENT_SECRETS.md",
  "docs/operations/INCIDENT_RESPONSE.md",
  "docs/operations/PRODUCTION_BASELINE_2026-08-21.md",
  "docs/operations/PRODUCTION_RELEASE.md",
  "docs/operations/STORAGE_SECURITY_VERIFICATION_2026-08-25.md",
  "scripts/test-http-authorization.mjs",
  "scripts/test-production-http-smoke.mjs",
  "scripts/test-storage-boundary.mjs",
  "supabase/seed.sql",
]) {
  if (!exists(requiredPath)) fail(`Required production-foundation file missing: ${requiredPath}`);
}

if (!pkg.scripts?.["test:production-http-smoke"]) {
  fail("package.json must expose test:production-http-smoke");
}

for (const workflowPath of [".github/workflows/ci.yml", ".github/workflows/http-authorization.yml"]) {
  if (!exists(workflowPath)) {
    fail(`Required Node.js workflow missing: ${workflowPath}`);
    continue;
  }
  const workflow = read(workflowPath);
  if (!/node-version:\s*22\b/.test(workflow)) {
    fail(`${workflowPath} must execute against canonical Node.js 22`);
  }
}

if (exists(".github/workflows/production-monitor.yml")) {
  const monitor = read(".github/workflows/production-monitor.yml");
  for (const requiredFragment of [
    "cron: '17 * * * *'",
    "issues: write",
    "persist-credentials: false",
    "scripts/test-production-http-smoke.mjs",
    "docs/operations/INCIDENT_RESPONSE.md",
    "[monitor] EntizNetStore production smoke failure",
  ]) {
    if (!monitor.includes(requiredFragment)) {
      fail(`Production monitor is missing required control: ${requiredFragment}`);
    }
  }
}

if (exists(".github/workflows/http-authorization.yml")) {
  const httpAuthorization = read(".github/workflows/http-authorization.yml");
  for (const requiredFragment of [
    "scripts/test-http-authorization.mjs",
    "scripts/test-storage-boundary.mjs",
    "ENTIZNETSTORE_BASE_URL=http://127.0.0.1:3000 node scripts/test-production-http-smoke.mjs",
    "supabase db reset --local",
  ]) {
    if (!httpAuthorization.includes(requiredFragment)) {
      fail(`HTTP authorization workflow is missing required control: ${requiredFragment}`);
    }
  }
}

if (exists("app/api/health/route.ts")) {
  const healthRoute = read("app/api/health/route.ts");
  for (const requiredFragment of [
    "admin.storage.listBuckets()",
    "kyc-documents",
    "message-attachments",
    "product-media",
    "seller-branding",
    "checks = { database, storage }",
  ]) {
    if (!healthRoute.includes(requiredFragment)) {
      fail(`Production readiness route lost required Storage health control: ${requiredFragment}`);
    }
  }
}

if (exists("scripts/test-production-http-smoke.mjs")) {
  const productionSmoke = read("scripts/test-production-http-smoke.mjs");
  for (const requiredFragment of [
    "body?.checks?.database !== 'ok'",
    "body?.checks?.storage !== 'ok'",
    "database=ok and storage=ok",
  ]) {
    if (!productionSmoke.includes(requiredFragment)) {
      fail(`Production smoke lost required readiness assertion: ${requiredFragment}`);
    }
  }
}

if (exists("scripts/test-http-authorization.mjs")) {
  const httpRegression = read("scripts/test-http-authorization.mjs");
  for (const requiredFragment of [
    "/api/seller/storefront",
    "/api/seller/branding",
    "/api/kyc/documents",
    "seller B cannot delete seller A product-media path",
    "seller branding rejects spoofed image bytes",
    "seller storefront update is authenticated-self scoped",
  ]) {
    if (!httpRegression.includes(requiredFragment)) {
      fail(`HTTP authorization regression lost required P0 coverage: ${requiredFragment}`);
    }
  }
}

if (exists("next.config.js")) {
  const nextConfig = read("next.config.js");
  if (!nextConfig.includes("private, no-store, max-age=0")) {
    fail("API responses must retain the production no-store header baseline");
  }
  if (!nextConfig.includes("if (!isProduction) scriptSources.push(\"'unsafe-eval'\")")) {
    fail("Production CSP must keep unsafe-eval restricted to non-production builds");
  }
}

if (failures.length > 0) {
  console.error("Production-foundation verification FAILED:\n");
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log(
  `Production-foundation verification passed (${runtimeFiles.length} runtime files, ${apiRouteFiles.length} API routes scanned).`,
);
