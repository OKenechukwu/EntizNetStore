import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const MESSAGE_ENCRYPTION_VERSION = "msg-aes-256-gcm-v1";
export const MESSAGE_KEY_WRAP_VERSION = "kek-aes-256-gcm-v1";

const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HKDF_SALT = Buffer.from("EntizNetStore:message-key-wrap:v1", "utf8");
const HKDF_INFO = Buffer.from("conversation-data-key", "utf8");

type WrappingKey = {
  id: string;
  key: Buffer;
};

type EnvelopeRow = {
  conversation_id: string;
  wrapped_key: string;
  wrap_iv: string;
  kek_id: string;
  key_wrap_version: string;
};

function fingerprint(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 16);
}

function normalizeKeyId(value: string | undefined, fallback: string) {
  const candidate = value?.trim();
  if (!candidate) return fallback;
  if (!/^[A-Za-z0-9._:-]{3,128}$/.test(candidate)) {
    throw new Error("MESSAGE_KEY_ENCRYPTION_KEY_ID has an invalid format");
  }
  return candidate;
}

function deriveWrappingKey(secret: string) {
  if (secret.length < 24) {
    throw new Error("Message key-encryption material is too short");
  }
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"), HKDF_SALT, HKDF_INFO, KEY_BYTES));
}

function addCandidate(
  candidates: WrappingKey[],
  secret: string | undefined,
  id: string | undefined,
  prefix: string,
) {
  const value = secret?.trim();
  if (!value) return;
  const fallback = `${prefix}-${fingerprint(value)}`;
  const candidate = {
    id: normalizeKeyId(id, fallback),
    key: deriveWrappingKey(value),
  };
  if (!candidates.some((current) => current.id === candidate.id)) {
    candidates.push(candidate);
  }
}

function wrappingKeys(): WrappingKey[] {
  const candidates: WrappingKey[] = [];

  addCandidate(
    candidates,
    process.env.MESSAGE_KEY_ENCRYPTION_KEY,
    process.env.MESSAGE_KEY_ENCRYPTION_KEY_ID,
    "message-kek",
  );
  addCandidate(
    candidates,
    process.env.MESSAGE_KEY_ENCRYPTION_KEY_PREVIOUS,
    process.env.MESSAGE_KEY_ENCRYPTION_KEY_PREVIOUS_ID,
    "message-kek-previous",
  );

  // Controlled rollout fallback: current production may still have only the
  // legacy service-role credential. Both Supabase server credential generations
  // are retained as unwrap candidates so adding SUPABASE_SECRET_KEY does not
  // strand envelopes created before the key migration. A dedicated message KEK
  // should be installed and envelopes rewrapped before either fallback is removed.
  addCandidate(candidates, process.env.SUPABASE_SECRET_KEY, undefined, "supabase-secret");
  addCandidate(
    candidates,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    undefined,
    "supabase-service-role",
  );

  if (!candidates.length) {
    throw new Error("No server-only message key-encryption material is configured");
  }
  return candidates;
}

function primaryWrappingKey() {
  return wrappingKeys()[0];
}

function envelopeAad(conversationId: string) {
  return Buffer.from(`EntizNetStore|conversation-key|${conversationId}|v1`, "utf8");
}

function messageAad(conversationId: string) {
  return Buffer.from(`EntizNetStore|message|${conversationId}|v1`, "utf8");
}

function encryptBuffer(plaintext: Buffer, key: Buffer, aad: Buffer) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    payload: Buffer.concat([ciphertext, tag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

function decryptBuffer(payload: string, ivValue: string, key: Buffer, aad: Buffer) {
  const packed = Buffer.from(payload, "base64");
  const iv = Buffer.from(ivValue, "base64");
  if (iv.length !== IV_BYTES || packed.length <= TAG_BYTES) {
    throw new Error("Encrypted message envelope has an invalid shape");
  }

  const ciphertext = packed.subarray(0, packed.length - TAG_BYTES);
  const tag = packed.subarray(packed.length - TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function wrapDataKey(conversationId: string, dataKey: Buffer) {
  const wrappingKey = primaryWrappingKey();
  const encrypted = encryptBuffer(dataKey, wrappingKey.key, envelopeAad(conversationId));
  return {
    wrappedKey: encrypted.payload,
    wrapIv: encrypted.iv,
    kekId: wrappingKey.id,
  };
}

function unwrapDataKey(row: EnvelopeRow) {
  if (row.key_wrap_version !== MESSAGE_KEY_WRAP_VERSION) {
    throw new Error("Unsupported conversation key-wrap version");
  }
  const wrappingKey = wrappingKeys().find((candidate) => candidate.id === row.kek_id);
  if (!wrappingKey) {
    throw new Error("Required conversation key-encryption key is unavailable");
  }
  const dataKey = decryptBuffer(
    row.wrapped_key,
    row.wrap_iv,
    wrappingKey.key,
    envelopeAad(row.conversation_id),
  );
  if (dataKey.length !== KEY_BYTES) {
    throw new Error("Conversation data key has an invalid size");
  }
  return dataKey;
}

async function readEnvelope(conversationId: string) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("message_key_envelopes")
    .select("conversation_id, wrapped_key, wrap_iv, kek_id, key_wrap_version")
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (error) throw new Error("Unable to load conversation key envelope");
  return (data as EnvelopeRow | null) ?? null;
}

export async function getOrCreateConversationDataKey(conversationId: string) {
  const existing = await readEnvelope(conversationId);
  if (existing) return unwrapDataKey(existing);

  const dataKey = randomBytes(KEY_BYTES);
  const envelope = wrapDataKey(conversationId, dataKey);
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("message_key_envelopes").insert({
    conversation_id: conversationId,
    wrapped_key: envelope.wrappedKey,
    wrap_iv: envelope.wrapIv,
    kek_id: envelope.kekId,
    key_wrap_version: MESSAGE_KEY_WRAP_VERSION,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (!error) return dataKey;
  if (error.code !== "23505") {
    throw new Error("Unable to initialize conversation key envelope");
  }

  const raced = await readEnvelope(conversationId);
  if (!raced) throw new Error("Conversation key initialization race could not be recovered");
  return unwrapDataKey(raced);
}

export async function getConversationDataKey(conversationId: string) {
  const envelope = await readEnvelope(conversationId);
  return envelope ? unwrapDataKey(envelope) : null;
}

export function encryptConversationMessage(
  conversationId: string,
  plaintext: string,
  dataKey: Buffer,
) {
  const encrypted = encryptBuffer(
    Buffer.from(plaintext, "utf8"),
    dataKey,
    messageAad(conversationId),
  );
  return {
    ciphertext: encrypted.payload,
    iv: encrypted.iv,
    encryptionVersion: MESSAGE_ENCRYPTION_VERSION,
  };
}

export function decryptConversationMessage(
  conversationId: string,
  ciphertext: string,
  iv: string,
  dataKey: Buffer,
) {
  return decryptBuffer(ciphertext, iv, dataKey, messageAad(conversationId)).toString("utf8");
}

export function describeMessageKeyBoundary() {
  const keys = wrappingKeys();
  return {
    primaryKekId: keys[0].id,
    availableKekIds: keys.map((key) => key.id),
    messageVersion: MESSAGE_ENCRYPTION_VERSION,
    keyWrapVersion: MESSAGE_KEY_WRAP_VERSION,
  };
}
