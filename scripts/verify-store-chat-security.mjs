import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const fail = (message) => {
  throw new Error(`Store Chat security verification failed: ${message}`);
};

const migration = read("supabase/migrations/20260902070000_m5_canonical_store_chat_authority.sql");
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
  if (!migration.includes(required)) fail(`migration is missing: ${required}`);
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
