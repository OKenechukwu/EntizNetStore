import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const fail = (message) => {
  throw new Error(`Message translation security verification failed: ${message}`);
};

const migration = read("supabase/migrations/20260903034500_m5_message_translation_cache.sql");
const cryptoCore = read("lib/messaging/messageTranslationCryptoCore.ts");
const providerCore = read("lib/messaging/messageTranslationProviderCore.ts");
const adapter = read("lib/messaging/messageTranslation.ts");
const route = read("app/api/messages/translate/route.ts");
const readiness = read("lib/launch/messagingReadiness.ts");
const health = read("app/api/health/route.ts");
const structural = read("scripts/test-m5-message-translation-structural-invariants.sql");
const authority = read("scripts/test-m5-message-translation-authority.sql");
const workflow = read(".github/workflows/message-translation-security.yml");
const env = read(".env.example");
const packageJson = read("package.json");

for (const required of [
  "create table public.message_translations",
  "original_integrity_digest",
  "unique (",
  "alter table public.message_translations enable row level security",
  "revoke all on table public.message_translations from public, anon, authenticated",
  "grant select, insert, update, delete on table public.message_translations to service_role",
]) {
  if (!migration.toLowerCase().includes(required.toLowerCase())) {
    fail(`translation migration is missing: ${required}`);
  }
}

for (const forbidden of ["original_text", "translated_text", "translation_text"]) {
  if (migration.toLowerCase().includes(`${forbidden} `)) {
    fail(`translation migration introduced plaintext column ${forbidden}`);
  }
}

for (const required of [
  "hkdfSync(",
  'createHmac("sha256"',
  'createCipheriv("aes-256-gcm"',
  'createDecipheriv("aes-256-gcm"',
  "message-translation-content",
  "message-translation-integrity",
  "originalIntegrityDigest",
]) {
  if (!cryptoCore.includes(required)) fail(`translation crypto is missing: ${required}`);
}
if (cryptoCore.includes("getSupabaseAdmin") || cryptoCore.includes("@/lib")) {
  fail("pure translation crypto core must not depend on application/admin clients");
}

for (const required of [
  "MESSAGE_TRANSLATION_ALLOWED_ORIGINS",
  "translation_private_host_forbidden",
  'redirect: "error"',
  'cache: "no-store"',
  "AbortSignal.timeout",
  "MAX_RESPONSE_BYTES",
  "translation_deterministic_forbidden_in_production",
]) {
  if (!providerCore.includes(required)) fail(`provider boundary is missing: ${required}`);
}

if (!adapter.includes('.from("message_translations")')) {
  fail("translation adapter must persist only through the server-only encrypted cache");
}
for (const required of [
  "claim_token",
  "lease_expires_at",
  "insert(insertPayload)",
  '.eq("claim_token", claim.claimToken)',
  "computeOriginalIntegrityDigest",
  "encryptMessageTranslation",
]) {
  if (!adapter.includes(required)) fail(`translation idempotency/integrity adapter is missing: ${required}`);
}

if (!route.includes('.from("messages")') || !route.includes("getConversationDataKey")) {
  fail("translation route must prove participant message access before decrypting");
}
if (route.includes("getSupabaseAdmin") || route.includes("admin.auth.admin")) {
  fail("translation route must not bypass participant RLS with privileged reads");
}
if (!route.includes('messageTranslationLaunchStatus() !== "configured"')) {
  fail("translation route must remain dark behind the server-side launch interlock");
}
if (!route.includes("decryptConversationMessage") || !route.includes("translateAuthorizedMessage")) {
  fail("translation route must derive from the canonical encrypted original");
}
if (/recipientId|orderId/.test(route)) {
  fail("translation route must not accept recipient/order authority from clients");
}

if (!readiness.includes("MESSAGE_KEY_ENCRYPTION_KEY") || !readiness.includes("messageTranslationLaunchStatus")) {
  fail("messaging readiness must distinguish dedicated Store Chat key and translation readiness");
}
if (!health.includes("storeChat: storeChatLaunchStatus()") || !health.includes("messageTranslation: messageTranslationLaunchStatus()")) {
  fail("health endpoint must expose machine-readable Store Chat and translation launch gates");
}

for (const required of [
  "browser translation-cache privilege leaked",
  "plaintext translation/original column introduced",
  "translation idempotency unique constraint missing",
]) {
  if (!structural.includes(required)) fail(`translation structural gate missing: ${required}`);
}
for (const required of [
  "authenticated browser read translation cache",
  "duplicate translation claim bypassed unique cache constraint",
  "active translation claim could be stolen before lease expiry",
]) {
  if (!authority.includes(required)) fail(`translation adversarial DB gate missing: ${required}`);
}

for (const required of [
  "scripts/verify-message-translation-security.mjs",
  "npm run test:message-translation",
  "scripts/test-m5-message-translation-structural-invariants.sql",
  "scripts/test-m5-message-translation-authority.sql",
]) {
  if (!workflow.includes(required)) fail(`translation workflow is missing: ${required}`);
}

for (const required of [
  "MESSAGE_TRANSLATION_MODE=disabled",
  "MESSAGE_TRANSLATION_LAUNCH_ENABLED=false",
  "MESSAGE_TRANSLATION_ALLOWED_ORIGINS",
  "MESSAGE_TRANSLATION_TOKEN",
]) {
  if (!env.includes(required)) fail(`environment template is missing ${required}`);
}

if (!packageJson.includes('"test:message-translation"') || !packageJson.includes("verify-message-translation-security.mjs")) {
  fail("foundation scripts do not permanently require translation security regressions");
}

const privilegedTokens = [
  "MESSAGE_TRANSLATION_TOKEN",
  "MESSAGE_TRANSLATION_URL",
  "MESSAGE_TRANSLATION_ALLOWED_ORIGINS",
  "MESSAGE_TRANSLATION_PROVIDER_ID",
  "@/lib/messaging/messageTranslation",
  "lib/messaging/messageTranslation",
  "@/lib/messaging/messageTranslationCryptoCore",
  "lib/messaging/messageTranslationCryptoCore",
];

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (/\.(tsx|jsx)$/.test(entry.name)) files.push(absolute);
  }
  return files;
}

for (const absolute of [...walk(path.join(root, "app")), ...walk(path.join(root, "components"))]) {
  const source = fs.readFileSync(absolute, "utf8");
  if (!/^\s*["']use client["'];?/m.test(source)) continue;
  for (const token of privilegedTokens) {
    if (source.includes(token)) {
      fail(`${path.relative(root, absolute)} exposes privileged translation token/import ${token}`);
    }
  }
}

process.stdout.write("Message translation security boundary verification passed\n");
