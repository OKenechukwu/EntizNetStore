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

// ---------------------------------------------------------------------------
// Runtime/template residue that must never re-enter the production branch.
// Historical provenance inside already-applied migrations and explanatory code
// comments is intentionally excluded: this gate targets executable assumptions.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Dependency contract: npm + package-lock.json are canonical. package.json and
// package-lock.json must agree exactly at the root and known legacy packages
// must be absent from the locked graph.
// ---------------------------------------------------------------------------
const pkg = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));
const lockRoot = lock.packages?.[""] ?? {};

if (!/^npm@/.test(pkg.packageManager ?? "")) {
  fail(`Canonical packageManager must be npm, found: ${pkg.packageManager ?? "missing"}`);
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

// ---------------------------------------------------------------------------
// Required production-foundation records.
// ---------------------------------------------------------------------------
for (const requiredPath of [
  ".env.example",
  "LAUNCH_BLOCKERS.md",
  "docs/architecture/ADR-0001-account-capabilities.md",
  "docs/operations/BACKUP_RECOVERY.md",
  "docs/operations/ENVIRONMENT_SECRETS.md",
  "docs/operations/PRODUCTION_BASELINE_2026-08-21.md",
  "supabase/seed.sql",
]) {
  if (!exists(requiredPath)) fail(`Required M0 production-foundation file missing: ${requiredPath}`);
}

if (failures.length > 0) {
  console.error("Production-foundation verification FAILED:\n");
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log(`Production-foundation verification passed (${runtimeFiles.length} runtime files scanned).`);
