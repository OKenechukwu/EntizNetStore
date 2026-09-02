import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.cwd();
const failures = [];
const require = createRequire(import.meta.url);

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

const privilegedNames = [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const privilegedImportFragments = [
  "/lib/supabase/admin",
  "@/lib/supabase/admin",
  "/lib/supabase/server",
  "@/lib/supabase/server",
];

for (const relativePath of ["app", "components", "lib"].flatMap(walk)) {
  if (!/\.[cm]?[jt]sx?$/.test(relativePath)) continue;
  const source = read(relativePath);
  if (!/^\s*["']use client["'];?/m.test(source)) continue;

  for (const secretName of privilegedNames) {
    if (source.includes(secretName)) {
      fail(`Client module ${relativePath} references privileged environment name ${secretName}`);
    }
  }

  for (const importFragment of privilegedImportFragments) {
    if (source.includes(importFragment)) {
      fail(`Client module ${relativePath} imports server-only module ${importFragment}`);
    }
  }
}

const admin = read("lib/supabase/admin.ts");
if (!admin.includes("process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY")) {
  fail("Privileged Supabase client must prefer SUPABASE_SECRET_KEY with a legacy service-role fallback");
}
if (/NEXT_PUBLIC_SUPABASE_(?:SECRET|SERVICE)/.test(admin)) {
  fail("Privileged Supabase client must never read privileged material from NEXT_PUBLIC_* variables");
}

for (const relativePath of [
  "lib/supabase/client.ts",
  "lib/supabase/server.ts",
  "lib/supabase/proxy.ts",
]) {
  const source = read(relativePath);
  if (!source.includes("process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")) {
    fail(`${relativePath} must prefer NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`);
  }
  if (!source.includes("process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY")) {
    fail(`${relativePath} must retain the controlled legacy anon-key fallback during migration`);
  }
}

const envExample = read(".env.example");
for (const requiredName of [
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  if (!envExample.includes(`${requiredName}=`)) {
    fail(`.env.example is missing ${requiredName}`);
  }
}

const configPath = path.join(root, "next.config.js");
const previousNodeEnv = process.env.NODE_ENV;
const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
process.env.NODE_ENV = "production";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ens-csp-proof.supabase.co";

try {
  delete require.cache[require.resolve(configPath)];
  const nextConfig = require(configPath);
  const headerRules = await nextConfig.headers();
  const globalRule = headerRules.find((rule) => rule.source === "/:path*");
  const csp = globalRule?.headers?.find((header) => header.key === "Content-Security-Policy")?.value;
  if (!csp) {
    fail("Global Content-Security-Policy header is missing");
  } else {
    const connectDirective = csp
      .split(";")
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith("connect-src "));
    const tokens = connectDirective?.split(/\s+/).slice(1) ?? [];
    const expected = new Set([
      "'self'",
      "https://ens-csp-proof.supabase.co",
      "wss://ens-csp-proof.supabase.co",
    ]);

    if (tokens.length !== expected.size || tokens.some((token) => !expected.has(token))) {
      fail(`Production connect-src must be same-origin + exact Supabase HTTP/WS origins; found: ${tokens.join(" ")}`);
    }
    if (tokens.includes("https:") || tokens.includes("http:") || tokens.includes("wss:") || tokens.includes("ws:")) {
      fail("Production connect-src must not contain scheme-wide browser egress wildcards");
    }
  }
} catch (error) {
  fail(`Unable to evaluate production CSP: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  if (previousSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
}

const staticChunks = path.join(root, ".next", "static", "chunks");
if (fs.existsSync(staticChunks)) {
  const secretValues = privilegedNames
    .map((name) => process.env[name])
    .filter((value) => typeof value === "string" && value.length >= 16);

  for (const relativePath of walk(path.relative(root, staticChunks))) {
    if (!/\.js$/.test(relativePath)) continue;
    const source = read(relativePath);
    for (const secretName of privilegedNames) {
      if (source.includes(secretName)) {
        fail(`Built browser chunk ${relativePath} contains privileged environment name ${secretName}`);
      }
    }
    for (const secretValue of secretValues) {
      if (source.includes(secretValue)) {
        fail(`Built browser chunk ${relativePath} contains a privileged Supabase credential value`);
      }
    }
  }
}

if (failures.length) {
  console.error("Browser-egress/service-boundary verification FAILED:\n");
  failures.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}

console.log("Browser-egress/service-boundary verification passed.");
