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

for (const relativePath of ["app", "components", "lib"].flatMap(walk)) {
  if (!/\.[cm]?[jt]sx?$/.test(relativePath)) continue;
  const source = read(relativePath);
  if (!/^\s*["']use client["'];?/m.test(source)) continue;
  if (/photon\.komoot\.io/i.test(source)) {
    fail(`Client module ${relativePath} must not connect directly to Photon`);
  }
}

const authCard = read("components/auth/AuthCard.tsx");
if (!authCard.includes("fetch('/api/geo/address-suggest'")) {
  fail("Auth address autocomplete must use the same-origin address suggestion API");
}
if (!authCard.includes("method: 'POST'")) {
  fail("Auth address autocomplete must POST the query so private address text is not placed in the URL");
}

const route = read("app/api/geo/address-suggest/route.ts");
for (const required of [
  "export async function POST",
  "MAX_BODY_BYTES = 1024",
  "Cache-Control\": \"private, no-store, max-age=0",
  "fetchAddressSuggestions(query)",
]) {
  if (!route.includes(required)) fail(`Address suggestion route lost required control: ${required}`);
}

const provider = read("lib/geo/addressSuggestions.ts");
for (const required of [
  'PHOTON_ENDPOINT = "https://photon.komoot.io/api/"',
  "MAX_RESPONSE_BYTES = 64 * 1024",
  "MAX_QUERY_CHARS = 160",
  'redirect: "error"',
  'cache: "no-store"',
  "AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)",
  'env.CI !== "true" || env.VERCEL_ENV === "production"',
]) {
  if (!provider.includes(required)) fail(`Address suggestion provider lost required control: ${required}`);
}
if (/NEXT_PUBLIC_/i.test(provider)) {
  fail("Server address suggestion provider must not depend on browser-visible configuration");
}

const workflow = read(".github/workflows/http-authorization.yml");
if (!workflow.includes("ADDRESS_SUGGEST_PROVIDER: deterministic")) {
  fail("HTTP/browser regression must select the deterministic address suggestion provider");
}

const pkg = JSON.parse(read("package.json"));
if (!pkg.scripts?.["test:address-suggestions"]) {
  fail("package.json must expose test:address-suggestions");
}

if (failures.length) {
  console.error("Address-suggestion boundary verification FAILED:\n");
  failures.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}

console.log("Address-suggestion browser/server boundary verification passed.");
