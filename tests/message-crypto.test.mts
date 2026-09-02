import assert from "node:assert/strict";
import test from "node:test";
import {
  createConversationDataKey,
  decryptConversationMessage,
  describeMessageKeyBoundary,
  encryptConversationMessage,
  MESSAGE_ENCRYPTION_VERSION,
  MESSAGE_KEY_WRAP_VERSION,
  unwrapConversationDataKey,
  wrapConversationDataKey,
  type MessageCryptoEnvironment,
} from "../lib/messaging/messageCryptoCore.ts";

const conversationA = "11111111-1111-4111-8111-111111111111";
const conversationB = "22222222-2222-4222-8222-222222222222";
const oldSecret = "old-message-kek-material-32-bytes-minimum-2026";
const newSecret = "new-message-kek-material-32-bytes-minimum-2026";

function oldEnv(): MessageCryptoEnvironment {
  return {
    MESSAGE_KEY_ENCRYPTION_KEY: oldSecret,
    MESSAGE_KEY_ENCRYPTION_KEY_ID: "message-kek-v1",
  };
}

test("conversation data keys are wrapped, not stored as raw Base64", () => {
  const dataKey = createConversationDataKey();
  const envelope = wrapConversationDataKey(conversationA, dataKey, oldEnv());

  assert.equal(envelope.key_wrap_version, MESSAGE_KEY_WRAP_VERSION);
  assert.equal(envelope.kek_id, "message-kek-v1");
  assert.notEqual(envelope.wrapped_key, dataKey.toString("base64"));
  assert.deepEqual(unwrapConversationDataKey(envelope, oldEnv()), dataKey);
});

test("key rotation can unwrap old envelopes while writing with the new primary", () => {
  const dataKey = createConversationDataKey();
  const oldEnvelope = wrapConversationDataKey(conversationA, dataKey, oldEnv());
  const rotationEnv: MessageCryptoEnvironment = {
    MESSAGE_KEY_ENCRYPTION_KEY: newSecret,
    MESSAGE_KEY_ENCRYPTION_KEY_ID: "message-kek-v2",
    MESSAGE_KEY_ENCRYPTION_KEY_PREVIOUS: oldSecret,
    MESSAGE_KEY_ENCRYPTION_KEY_PREVIOUS_ID: "message-kek-v1",
  };

  assert.deepEqual(unwrapConversationDataKey(oldEnvelope, rotationEnv), dataKey);

  const newEnvelope = wrapConversationDataKey(conversationA, dataKey, rotationEnv);
  assert.equal(newEnvelope.kek_id, "message-kek-v2");
  assert.deepEqual(unwrapConversationDataKey(newEnvelope, rotationEnv), dataKey);

  assert.throws(
    () =>
      unwrapConversationDataKey(oldEnvelope, {
        MESSAGE_KEY_ENCRYPTION_KEY: newSecret,
        MESSAGE_KEY_ENCRYPTION_KEY_ID: "message-kek-v2",
      }),
    /unavailable/,
  );
});

test("message encryption authenticates ciphertext and binds it to one conversation", () => {
  const dataKey = createConversationDataKey();
  const original = "The original marketplace message remains canonical.";
  const encrypted = encryptConversationMessage(conversationA, original, dataKey);

  assert.equal(encrypted.encryptionVersion, MESSAGE_ENCRYPTION_VERSION);
  assert.notEqual(encrypted.ciphertext, Buffer.from(original).toString("base64"));
  assert.equal(
    decryptConversationMessage(conversationA, encrypted.ciphertext, encrypted.iv, dataKey),
    original,
  );

  assert.throws(
    () => decryptConversationMessage(conversationB, encrypted.ciphertext, encrypted.iv, dataKey),
  );

  const bytes = Buffer.from(encrypted.ciphertext, "base64");
  bytes[0] ^= 0x01;
  assert.throws(() =>
    decryptConversationMessage(conversationA, bytes.toString("base64"), encrypted.iv, dataKey),
  );
});

test("key-wrap policy rejects weak material and malformed explicit key ids", () => {
  const dataKey = createConversationDataKey();
  assert.throws(
    () =>
      wrapConversationDataKey(conversationA, dataKey, {
        MESSAGE_KEY_ENCRYPTION_KEY: "too-short",
      }),
    /too short/,
  );
  assert.throws(
    () =>
      wrapConversationDataKey(conversationA, dataKey, {
        MESSAGE_KEY_ENCRYPTION_KEY: oldSecret,
        MESSAGE_KEY_ENCRYPTION_KEY_ID: "bad id with spaces",
      }),
    /invalid format/,
  );
});

test("Supabase server credentials are fallback candidates, never browser credentials", () => {
  const boundary = describeMessageKeyBoundary({
    SUPABASE_SECRET_KEY: "sb_secret_server_only_material_long_enough_2026",
    SUPABASE_SERVICE_ROLE_KEY: "legacy_service_role_server_only_material_2026",
  });

  assert.match(boundary.primaryKekId, /^supabase-secret-/);
  assert.equal(boundary.availableKekIds.length, 2);
  assert.equal(boundary.messageVersion, MESSAGE_ENCRYPTION_VERSION);
  assert.equal(boundary.keyWrapVersion, MESSAGE_KEY_WRAP_VERSION);
});
