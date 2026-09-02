import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  createConversationDataKey,
  decryptConversationMessage,
  describeMessageKeyBoundary as describeCoreBoundary,
  encryptConversationMessage,
  MESSAGE_ENCRYPTION_VERSION,
  MESSAGE_KEY_WRAP_VERSION,
  type MessageCryptoEnvironment,
  type MessageKeyEnvelope,
  unwrapConversationDataKey as unwrapCoreDataKey,
  wrapConversationDataKey as wrapCoreDataKey,
} from "./messageCryptoCore";

export {
  decryptConversationMessage,
  encryptConversationMessage,
  MESSAGE_ENCRYPTION_VERSION,
  MESSAGE_KEY_WRAP_VERSION,
};
export type { MessageKeyEnvelope };

function runtimeCryptoEnvironment(): MessageCryptoEnvironment {
  return {
    MESSAGE_KEY_ENCRYPTION_KEY: process.env.MESSAGE_KEY_ENCRYPTION_KEY,
    MESSAGE_KEY_ENCRYPTION_KEY_ID: process.env.MESSAGE_KEY_ENCRYPTION_KEY_ID,
    MESSAGE_KEY_ENCRYPTION_KEY_PREVIOUS: process.env.MESSAGE_KEY_ENCRYPTION_KEY_PREVIOUS,
    MESSAGE_KEY_ENCRYPTION_KEY_PREVIOUS_ID: process.env.MESSAGE_KEY_ENCRYPTION_KEY_PREVIOUS_ID,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export function wrapConversationDataKey(conversationId: string, dataKey: Buffer) {
  return wrapCoreDataKey(conversationId, dataKey, runtimeCryptoEnvironment());
}

export function unwrapConversationDataKey(row: MessageKeyEnvelope) {
  return unwrapCoreDataKey(row, runtimeCryptoEnvironment());
}

async function readEnvelope(conversationId: string) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("message_key_envelopes")
    .select("conversation_id, wrapped_key, wrap_iv, kek_id, key_wrap_version")
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (error) throw new Error("Unable to load conversation key envelope");
  return (data as MessageKeyEnvelope | null) ?? null;
}

export async function getOrCreateConversationDataKey(conversationId: string) {
  const existing = await readEnvelope(conversationId);
  if (existing) return unwrapConversationDataKey(existing);

  const dataKey = createConversationDataKey();
  const envelope = wrapConversationDataKey(conversationId, dataKey);
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("message_key_envelopes").insert({
    ...envelope,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (!error) return dataKey;
  if (error.code !== "23505") {
    throw new Error("Unable to initialize conversation key envelope");
  }

  const raced = await readEnvelope(conversationId);
  if (!raced) throw new Error("Conversation key initialization race could not be recovered");
  return unwrapConversationDataKey(raced);
}

export async function getConversationDataKey(conversationId: string) {
  const envelope = await readEnvelope(conversationId);
  return envelope ? unwrapConversationDataKey(envelope) : null;
}

export function describeMessageKeyBoundary() {
  return describeCoreBoundary(runtimeCryptoEnvironment());
}
