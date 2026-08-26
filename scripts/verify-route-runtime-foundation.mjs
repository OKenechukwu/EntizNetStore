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

for (const forbiddenPath of [
  ".eslintrc.json",
  "middleware.ts",
  "app/admin/i18n/seed",
  "app/components/ProductImageUploader.tsx",
  "app/internal",
]) {
  if (exists(forbiddenPath)) {
    fail(`Obsolete/development production surface must not exist: ${forbiddenPath}`);
  }
}

if (!exists("proxy.ts")) {
  fail("Next 16 root proxy.ts is required");
} else {
  const proxy = read("proxy.ts");
  if (!/\bexport\s+async\s+function\s+proxy\s*\(/.test(proxy)) {
    fail("Next 16 proxy must be async so Supabase auth tokens can be refreshed before request handling");
  }
  for (const requiredFragment of [
    'updateSupabaseSession',
    'request.cookies.get("locale")',
    'request.cookies.get("currency")',
    'matcher: ["/((?!_next|.*\\\\..*).*)"]',
  ]) {
    if (!proxy.includes(requiredFragment)) {
      fail(`Proxy lost required request/cookie control: ${requiredFragment}`);
    }
  }
}

if (!exists("lib/supabase/proxy.ts")) {
  fail("Supabase SSR session refresher is required at lib/supabase/proxy.ts");
} else {
  const supabaseProxy = read("lib/supabase/proxy.ts");
  for (const requiredFragment of [
    'createServerClient',
    'request.cookies.getAll()',
    'request.cookies.set(name, value)',
    'response.cookies.set(name, value, options)',
    'response.headers.set("Cache-Control", "private, no-store, max-age=0")',
    'supabase.auth.getClaims()',
  ]) {
    if (!supabaseProxy.includes(requiredFragment)) {
      fail(`Supabase SSR proxy lost required session control: ${requiredFragment}`);
    }
  }
  if (/supabase\.auth\.getSession\s*\(/.test(supabaseProxy)) {
    fail("Supabase SSR proxy must validate with getClaims(), not trust getSession()");
  }
}

const tsconfig = JSON.parse(read("tsconfig.json"));
const compilerOptions = tsconfig.compilerOptions ?? {};
if (compilerOptions.target !== "ES2017") {
  fail(`TypeScript target must be ES2017 for deterministic Next 16 builds, found: ${compilerOptions.target ?? "missing"}`);
}
if (compilerOptions.jsx !== "react-jsx") {
  fail(`TypeScript jsx mode must be react-jsx for deterministic Next 16 builds, found: ${compilerOptions.jsx ?? "missing"}`);
}
const includes = Array.isArray(tsconfig.include) ? tsconfig.include : [];
for (const requiredInclude of [".next/types/**/*.ts", ".next/dev/types/**/*.ts"]) {
  if (!includes.includes(requiredInclude)) {
    fail(`TypeScript include lost Next-generated type path: ${requiredInclude}`);
  }
}

const sourceRoots = ["app", "components", "lib", "proxy.ts"];
const runtimeFiles = sourceRoots.flatMap((entry) => walk(entry));
const forbiddenLegacyTokens = [
  { label: "legacy internal-open feature flag", value: "INTERNAL_OPEN" },
  { label: "browser admin seed token", value: "ADMIN_SEED_TOKEN" },
  { label: "legacy store-products bucket", value: '"store-products"' },
  { label: "legacy i18n seed API", value: "/api/i18n/seed-all" },
];
const deprecatedEdgeRuntimePattern = /\bexport\s+const\s+runtime\s*=\s*["'`]edge["'`]/;

for (const relativePath of runtimeFiles) {
  if (!/\.[cm]?[jt]sx?$/.test(relativePath)) continue;
  const source = read(relativePath);
  for (const { label, value } of forbiddenLegacyTokens) {
    if (source.includes(value)) {
      fail(`${label} found in production runtime source: ${relativePath}`);
    }
  }
  if (deprecatedEdgeRuntimePattern.test(source)) {
    fail(`Deprecated Next.js Edge Runtime opt-in found in production source: ${relativePath}`);
  }
}

const forbiddenPageRouteSegments = new Set([
  "debug",
  "dev",
  "fixture",
  "fixtures",
  "internal",
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
const pageRouteFiles = walk("app").filter((relativePath) => /(?:^|[\\/])page\.[cm]?[jt]sx?$/.test(relativePath));

for (const relativePath of pageRouteFiles) {
  const normalizedPath = relativePath.split(path.sep).join("/");
  const routeSegments = normalizedPath.split("/").slice(1, -1);
  for (const segment of routeSegments) {
    const normalizedSegment = segment.replace(/^\((.*)\)$/, "$1").toLowerCase();
    if (forbiddenPageRouteSegments.has(normalizedSegment)) {
      fail(`Forbidden production page route segment '${segment}' found in ${normalizedPath}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Route/runtime foundation verification FAILED:\n");
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log(
  `Route/runtime foundation verification passed (${runtimeFiles.length} runtime files, ${pageRouteFiles.length} page routes scanned).`,
);
