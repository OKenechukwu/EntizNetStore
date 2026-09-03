import assert from "node:assert/strict";
import test from "node:test";
import {
  computeOriginalIntegrityDigest,
  decryptMessageTranslation,
  encryptMessageTranslation,
  MESSAGE_TRANSLATION_ENCRYPTION_VERSION,
} from "../lib/messaging/messageTranslationCryptoCore.ts";

const dataKey = Buffer.alloc(32, 7);
const conversationId = "11111111-1111-4111-8111-111111111111";
const messageId = "22222222-2222-4222-8222-222222222222";
const original = "Canonical originals must never be replaced by translations.";

function digest() {
  return computeOriginalIntegrityDigest(original, dataKey, {
    conversationId,
    messageId,
    originalEncryptionVersion: "msg-aes-256-gcm-v1",
  });
}

function context(overrides: Partial<{
  conversationId: string;
  messageId: string;
  targetLanguage: string;
  provider: string;
  providerVersion: string;
  originalIntegrityDigest: string;
}> = {}) {
  return {
    conversationId,
    messageId,
    targetLanguage: "es",
    provider: "gateway",
    providerVersion: "2026-09",
    originalIntegrityDigest: digest(),
    ...overrides,
  };
}

test("original integrity uses a keyed digest rather than a raw plaintext hash", async () => {
  const crypto = await import("node:crypto");
  const raw = crypto.createHash("sha256").update(original).digest("hex");
  const keyed = digest();
  assert.match(keyed, /^[0-9a-f]{64}$/);
  assert.notEqual(keyed, raw);
  assert.equal(keyed, digest());
});

test("translation ciphertext round-trips and is purpose-bound", () => {
  const translated = "Los originales canónicos nunca deben ser reemplazados.";
  const encrypted = encryptMessageTranslation(translated, dataKey, context());

  assert.equal(encrypted.encryptionVersion, MESSAGE_TRANSLATION_ENCRYPTION_VERSION);
  assert.notEqual(encrypted.ciphertext, Buffer.from(translated).toString("base64"));
  assert.equal(
    decryptMessageTranslation(
      encrypted.ciphertext,
      encrypted.iv,
      dataKey,
      context(),
      encrypted.encryptionVersion,
    ),
    translated,
  );

  for (const changed of [
    context({ targetLanguage: "fr" }),
    context({ provider: "other" }),
    context({ providerVersion: "2026-10" }),
    context({ messageId: "33333333-3333-4333-8333-333333333333" }),
    context({ originalIntegrityDigest: "0".repeat(64) }),
  ]) {
    assert.throws(() =>
      decryptMessageTranslation(
        encrypted.ciphertext,
        encrypted.iv,
        dataKey,
        changed,
        encrypted.encryptionVersion,
      ),
    );
  }
});

test("translation authentication detects ciphertext tampering", () => {
  const encrypted = encryptMessageTranslation("bonjour", dataKey, context({ targetLanguage: "fr" }));
  const bytes = Buffer.from(encrypted.ciphertext, "base64");
  bytes[0] ^= 1;
  assert.throws(() =>
    decryptMessageTranslation(
      bytes.toString("base64"),
      encrypted.iv,
      dataKey,
      context({ targetLanguage: "fr" }),
      encrypted.encryptionVersion,
    ),
  );
});

test("translation encryption rejects wrong key sizes and versions", () => {
  assert.throws(() => encryptMessageTranslation("x", Buffer.alloc(16), context()), /256 bits/);
  const encrypted = encryptMessageTranslation("x", dataKey, context());
  assert.throws(() =>
    decryptMessageTranslation(encrypted.ciphertext, encrypted.iv, dataKey, context(), "future"),
  );
});
