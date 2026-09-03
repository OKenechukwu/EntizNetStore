import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from "node:crypto";

export const MESSAGE_TRANSLATION_ENCRYPTION_VERSION = "translation-aes-256-gcm-v1";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HKDF_SALT = Buffer.from("EntizNetStore:message-translation:v1", "utf8");

export type TranslationCryptoContext = {
  conversationId: string;
  messageId: string;
  targetLanguage: string;
  provider: string;
  providerVersion: string;
  originalIntegrityDigest: string;
};

export type OriginalIntegrityContext = {
  conversationId: string;
  messageId: string;
  originalEncryptionVersion: string;
};

function requireConversationKey(dataKey: Buffer) {
  if (dataKey.length !== KEY_BYTES) {
    throw new Error("Conversation data key must be 256 bits");
  }
}

function derivePurposeKey(dataKey: Buffer, purpose: string, conversationId: string, messageId: string) {
  requireConversationKey(dataKey);
  return Buffer.from(
    hkdfSync(
      "sha256",
      dataKey,
      HKDF_SALT,
      Buffer.from(JSON.stringify(["EntizNetStore", purpose, "v1", conversationId, messageId]), "utf8"),
      KEY_BYTES,
    ),
  );
}

function translationAad(context: TranslationCryptoContext) {
  return Buffer.from(
    JSON.stringify([
      "EntizNetStore",
      "message-translation",
      "v1",
      context.conversationId,
      context.messageId,
      context.targetLanguage,
      context.provider,
      context.providerVersion,
      context.originalIntegrityDigest,
    ]),
    "utf8",
  );
}

export function computeOriginalIntegrityDigest(
  plaintext: string,
  dataKey: Buffer,
  context: OriginalIntegrityContext,
) {
  const integrityKey = derivePurposeKey(
    dataKey,
    "message-translation-integrity",
    context.conversationId,
    context.messageId,
  );
  return createHmac("sha256", integrityKey)
    .update(
      JSON.stringify([
        context.conversationId,
        context.messageId,
        context.originalEncryptionVersion,
        plaintext,
      ]),
      "utf8",
    )
    .digest("hex");
}

export function encryptMessageTranslation(
  plaintext: string,
  dataKey: Buffer,
  context: TranslationCryptoContext,
) {
  const key = derivePurposeKey(
    dataKey,
    "message-translation-content",
    context.conversationId,
    context.messageId,
  );
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(translationAad(context));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: Buffer.concat([ciphertext, tag]).toString("base64"),
    iv: iv.toString("base64"),
    encryptionVersion: MESSAGE_TRANSLATION_ENCRYPTION_VERSION,
  };
}

export function decryptMessageTranslation(
  ciphertext: string,
  ivValue: string,
  dataKey: Buffer,
  context: TranslationCryptoContext,
  encryptionVersion: string,
) {
  if (encryptionVersion !== MESSAGE_TRANSLATION_ENCRYPTION_VERSION) {
    throw new Error("Unsupported message translation encryption version");
  }

  const packed = Buffer.from(ciphertext, "base64");
  const iv = Buffer.from(ivValue, "base64");
  if (iv.length !== IV_BYTES || packed.length <= TAG_BYTES) {
    throw new Error("Encrypted message translation has an invalid shape");
  }

  const key = derivePurposeKey(
    dataKey,
    "message-translation-content",
    context.conversationId,
    context.messageId,
  );
  const payload = packed.subarray(0, packed.length - TAG_BYTES);
  const tag = packed.subarray(packed.length - TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  decipher.setAAD(translationAad(context));
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(payload), decipher.final()]).toString("utf8");
}
