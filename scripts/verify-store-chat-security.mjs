import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const fail = (message) => {
  throw new Error(`Store Chat security verification failed: ${message}`);
};

const migration = read("supabase/migrations/20260902070000_m5_canonical_store_chat_authority.sql");
const keySurfaceMigration = read("supabase/migrations/20260902071500_m5_key_envelope_surface_canonicalization.sql");
const privateAuthorityMigration = read("supabase/migrations/20260902072000_m5_store_chat_private_authority_wrappers.sql");
const creatorIndexMigration = read("supabase/migrations/20260903033000_m5_conversation_created_by_index.sql");
const structuralInvariants = read("scripts/test-m5-store-chat-structural-invariants.sql");
const storeChatWorkflow = read(".github/workflows/store-chat-security.yml");
const sendRoute = read("app/api/messages/send/route.ts");
const listRoute = read("app/api/messages/conversations/route.ts");
const legacySend = read("app/api/chat/send/route.ts");
const legacyConversation = read("app/api/messages/conversation/[userId]/route.ts");
const dashboard = read("app/dashboard/messages/page.tsx");
const envTemplate = read(".env.example");
const cryptoCore = read("lib/messaging/messageCryptoCore.ts");
const cryptoServer = read("lib/messaging/messageCrypto.ts");

for (const required of [
  "create table public.message_key_envelopes",
  "create or replace function public.open_store_conversation",
  "create or replace function public.send_store_message",
  "revoke all on public.conversation_keys from anon, authenticated",
  "revoke all on public.messages from anon, authenticated",
  "grant select on public.messages to authenticated",
]) {
  if (!migration.includes(required)) fail(`authority migration is missing: ${required}`);
}

for (const required of [
  "legacy_conversation_keys_must_be_empty_before_m5_envelope_transition",
  "message_key_envelopes_must_be_empty_before_m5_surface_transition",
  "drop table public.message_key_envelopes",
  "rename column encrypted_key to wrapped_key",
  "create view public.message_key_envelopes",
  "security_invoker = true",
  "revoke all on public.conversation_keys from public, anon, authenticated",
  "revoke all on public.message_key_envelopes from public, anon, authenticated",
]) {
  if (!keySurfaceMigration.includes(required)) fail(`key-surface migration is missing: ${required}`);
}

for (const required of [
  "alter function public.open_store_conversation(text,uuid)",
  "alter function public.send_store_message(uuid,text,text,text,text)",
  "alter function public.mark_store_conversation_read(uuid)",
  "set schema app_private",
  "rename to open_store_conversation_authority",
  "rename to send_store_message_authority",
  "rename to mark_store_conversation_read_authority",
  "create function public.open_store_conversation",
  "create function public.send_store_message",
  "create function public.mark_store_conversation_read",
  "security invoker",
  "revoke all on function public.open_store_conversation(text,uuid)",
  "revoke all on function public.send_store_message(uuid,text,text,text,text)",
  "revoke all on function public.mark_store_conversation_read(uuid)",
]) {
  if (!privateAuthorityMigration.includes(required)) {
    fail(`private-authority migration is missing: ${required}`);
  }
}

for (const privateFn of [
  "app_private.open_store_conversation_authority(text,uuid)",
  "app_private.send_store_message_authority(uuid,text,text,text,text)",
  "app_private.mark_store_conversation_read_authority(uuid)",
]) {
  if (!privateAuthorityMigration.includes(`revoke all on function ${privateFn}`)) {
    fail(`private authority ${privateFn} must explicitly revoke default execution`);
  }
}

if (
  !creatorIndexMigration.includes("create index if not exists idx_conversations_created_by") ||
  !creatorIndexMigration.includes("on public.conversations(created_by)")
) {
  fail("advisor-discovered conversations.created_by covering index migration is missing");
}

for (const required of [
  "idx_conversations_created_by",
  "security_invoker=true",
  "canonical public physical table count changed",
  "browser key-envelope privilege leaked",
  "public Store Chat wrapper became SECURITY DEFINER",
]) {
  if (!structuralInvariants.includes(required)) {
    fail(`hosted structural invariant is missing: ${required}`);
  }
}

if (
  !storeChatWorkflow.includes("scripts/test-m5-store-chat-structural-invariants.sql") ||
  !storeChatWorkflow.includes("scripts/test-m5-store-chat-authority.sql")
) {
  fail("Store Chat workflow must run structural and adversarial database regressions");
}

const sendSignature = migration.match(
  /create or replace function public\.send_store_message\(([\s\S]*?)\)\nreturns uuid/i,
)?.[1];
if (!sendSignature) fail("unable to inspect send_store_message signature");
if (/recipient|order[_ ]?id/i.test(sendSignature)) {
  fail("send_store_message must not accept caller-supplied recipient/order authority");
}
if (
  !migration.includes("v_recipient := v_conversation.participant2_id") ||
  !migration.includes("v_recipient := v_conversation.participant1_id")
) {
  fail("send_store_message must derive the recipient from canonical conversation participants");
}

const publicWrapperSignature = privateAuthorityMigration.match(
  /create function public\.send_store_message\(([\s\S]*?)\)\nreturns uuid/i,
)?.[1];
if (!publicWrapperSignature) fail("unable to inspect public send_store_message wrapper signature");
if (/recipient|order[_ ]?id/i.test(publicWrapperSignature)) {
  fail("public send wrapper must not accept caller-supplied recipient/order authority");
}

if (!sendRoute.includes('conversationId: z.string().uuid()')) {
  fail("canonical send route must require conversationId");
}
if (/recipientId|orderId/.test(sendRoute)) {
  fail("canonical send route must not accept recipientId/orderId authority from the client");
}
if (!sendRoute.includes('supabase.rpc("send_store_message"')) {
  fail("canonical send route must use the database send authority RPC");
}
if (sendRoute.includes('.from("messages").insert') || sendRoute.includes("admin.auth.admin")) {
  fail("canonical send route must not service-role insert messages or inspect Auth users");
}

if (!legacySend.includes("status: 410") || legacySend.includes('.from("messages")')) {
  fail("legacy plaintext chat sender must be retired fail-closed");
}
if (!legacyConversation.includes("status: 410")) {
  fail("legacy user-UUID conversation route must be retired");
}

if (!dashboard.includes("conversationId: selectedConversationId")) {
  fail("message dashboard must send by canonical conversation id");
}
if (dashboard.includes("recipientId: selectedConversation")) {
  fail("message dashboard still sends a caller-selected recipient id");
}
if (!dashboard.includes("/api/messages/conversations/${conversationId}")) {
  fail("message dashboard must load canonical conversation detail");
}

if (/admin\.auth\.admin\.getUserById|other_user|\.email\b/.test(listRoute)) {
  fail("conversation list must not disclose or depend on Auth email identity");
}

for (const required of [
  "MESSAGE_KEY_ENCRYPTION_KEY=",
  "MESSAGE_KEY_ENCRYPTION_KEY_ID=",
  "MESSAGE_KEY_ENCRYPTION_KEY_PREVIOUS",
]) {
  if (!envTemplate.includes(required)) fail(`environment template is missing ${required}`);
}
if (!cryptoCore.includes('createCipheriv("aes-256-gcm"') || !cryptoCore.includes("hkdfSync")) {
  fail("crypto core must retain authenticated AES-256-GCM wrapping and HKDF derivation");
}
if (cryptoCore.includes("getSupabaseAdmin") || cryptoCore.includes("@/lib")) {
  fail("pure crypto core must not depend on privileged application clients");
}
if (!cryptoServer.includes("message_key_envelopes") || !cryptoServer.includes("getSupabaseAdmin")) {
  fail("server crypto adapter must restrict privileged persistence to key envelopes");
}

const privilegedTokens = [
  "MESSAGE_KEY_ENCRYPTION_KEY",
  "MESSAGE_KEY_ENCRYPTION_KEY_PREVIOUS",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "@/lib/messaging/messageCrypto",
  "lib/messaging/messageCrypto",
];

function walk(directory) {
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
      fail(`${path.relative(root, absolute)} exposes privileged messaging token/import ${token}`);
    }
  }
}

process.stdout.write("Store Chat security boundary verification passed\n");