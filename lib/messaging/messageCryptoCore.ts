import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from "node:crypto";

export const MESSAGE_ENCRYPTION_VERSION = "msg-aes-256-gcm-v1";
export const MESSAGE_KEY_WRAP_VERSION = "kek-aes-256-gcm-v1";
export const MESSAGE_DATA_KEY_BYTES = 32;

const IV_BYTES = 12;
const TAG_BYTES = 16;
const HKDF_SALT = Buffer.from("EntizNetStore:message-key-wrap:v1", "utf8");
const HKDF_INFO = Buffer.from("conversation-data-key", "utf8");

type WrappingKey = {
  id: string;
  key: Buffer;
};

export type MessageKeyEnvelope = {
  conversation_id: string;
  wrapped_key: string;
  wrap_iv: string;
  kek_id: string;
  key_wrap_version: string;
};

export type MessageCryptoEnvironment = {
  MESSAGE_KEY_ENCRYPTION_KEY?: string;
  MESSAGE_KEY_ENCRYPTION_KEY_ID?: string;
  MESSAGE_KEY_ENCRYPTION_KEY_PREVIOUS?: string;
  MESSAGE_KEY_ENCRYPTION_KEY_PREVIOUS_ID?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
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
  return Buffer.from(
    hkdfSync("sha256", Buffer.from(secret, "utf8"), HKDF_SALT, HKDF_INFO, MESSAGE_DATA_KEY_BYTES),
  );
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

function wrappingKeys(env: MessageCryptoEnvironment): WrappingKey[] {
  const candidates: WrappingKey[] = [];
  addCandidate(
    candidates,
    env.MESSAGE_KEY_ENCRYPTION_KEY,
    env.MESSAGE_KEY_ENCRYPTION_KEY_ID,
    "message-kek",
  );
  addCandidate(
    candidates,
    env.MESSAGE_KEY_ENCRYPTION_KEY_PREVIOUS,
    env.MESSAGE_KEY_ENCRYPTION_KEY_PREVIOUS_ID,
    "message-kek-previous",
  );
  addCandidate(candidates, env.SUPABASE_SECRET_KEY, undefined, "supabase-secret");
  addCandidate(
    candidates,
    env.SUPABASE_SERVICE_ROLE_KEY,
    undefined,
    "supabase-service-role",
  );
  if (!candidates.length) {
    throw new Error("No server-only message key-encryption material is configured");
  }
  return candidates;
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

export function createConversationDataKey() {
  return randomBytes(MESSAGE_DATA_KEY_BYTES);
}

export function wrapConversationDataKey(
  conversationId: string,
  dataKey: Buffer,
  env: MessageCryptoEnvironment,
) {
  if (dataKey.length !== MESSAGE_DATA_KEY_BYTES) {
    throw new Error("Conversation data key must be 256 bits");
  }
  const wrappingKey = wrappingKeys(env)[0];
  const encrypted = encryptBuffer(dataKey, wrappingKey.key, envelopeAad(conversationId));
  return {
    conversation_id: conversationId,
    wrapped_key: encrypted.payload,
    wrap_iv: encrypted.iv,
    kek_id: wrappingKey.id,
    key_wrap_version: MESSAGE_KEY_WRAP_VERSION,
  } satisfies MessageKeyEnvelope;
}

export function unwrapConversationDataKey(
  row: MessageKeyEnvelope,
  env: MessageCryptoEnvironment,
) {
  if (row.key_wrap_version !== MESSAGE_KEY_WRAP_VERSION) {
    throw new Error("Unsupported conversation key-wrap version");
  }
  const wrappingKey = wrappingKeys(env).find((candidate) => candidate.id === row.kek_id);
  if (!wrappingKey) {
    throw new Error("Required conversation key-encryption key is unavailable");
  }
  const dataKey = decryptBuffer(
    row.wrapped_key,
    row.wrap_iv,
    wrappingKey.key,
    envelopeAad(row.conversation_id),
  );
  if (dataKey.length !== MESSAGE_DATA_KEY_BYTES) {
    throw new Error("Conversation data key has an invalid size");
  }
  return dataKey;
}

export function encryptConversationMessage(
  conversationId: string,
  plaintext: string,
  dataKey: Buffer,
) {
  if (dataKey.length !== MESSAGE_DATA_KEY_BYTES) {
    throw new Error("Conversation data key must be 256 bits");
  }
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
  if (dataKey.length !== MESSAGE_DATA_KEY_BYTES) {
    throw new Error("Conversation data key must be 256 bits");
  }
  return decryptBuffer(ciphertext, iv, dataKey, messageAad(conversationId)).toString("utf8");
}

export function describeMessageKeyBoundary(env: MessageCryptoEnvironment) {
  const keys = wrappingKeys(env);
  return {
    primaryKekId: keys[0].id,
    availableKekIds: keys.map((key) => key.id),
    messageVersion: MESSAGE_ENCRYPTION_VERSION,
    keyWrapVersion: MESSAGE_KEY_WRAP_VERSION,
  };
}
