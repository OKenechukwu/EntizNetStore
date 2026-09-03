import assert from "node:assert/strict";
import test from "node:test";
import {
  executeMessageTranslation,
  normalizeTranslationLanguage,
  validateMessageTranslationConfiguration,
  type MessageTranslationEnvironment,
} from "../lib/messaging/messageTranslationProviderCore.ts";

const requestId = "11111111-1111-4111-8111-111111111111";

function productionEnv(overrides: Partial<MessageTranslationEnvironment> = {}): MessageTranslationEnvironment {
  return {
    NODE_ENV: "production",
    MESSAGE_TRANSLATION_MODE: "remote",
    MESSAGE_TRANSLATION_URL: "https://translate.example.com/v1/translate",
    MESSAGE_TRANSLATION_ALLOWED_ORIGINS: "https://translate.example.com",
    MESSAGE_TRANSLATION_TOKEN: "server-only-translation-token",
    MESSAGE_TRANSLATION_PROVIDER_ID: "translation-gateway",
    MESSAGE_TRANSLATION_PROVIDER_VERSION: "v1",
    ...overrides,
  };
}

test("translation language canonicalization is bounded", () => {
  assert.equal(normalizeTranslationLanguage("pt-br"), "pt-BR");
  assert.equal(normalizeTranslationLanguage("zh-Hant"), "zh-Hant");
  assert.equal(normalizeTranslationLanguage("not a locale"), null);
  assert.equal(normalizeTranslationLanguage("x".repeat(100)), null);
});

test("production translation is fail-closed for unsafe endpoints and deterministic mode", () => {
  assert.deepEqual(
    validateMessageTranslationConfiguration({
      NODE_ENV: "production",
      MESSAGE_TRANSLATION_MODE: "deterministic",
    }),
    { ok: false, code: "translation_deterministic_forbidden_in_production" },
  );

  for (const url of [
    "http://translate.example.com/v1",
    "https://127.0.0.1/v1",
    "https://localhost/v1",
    "https://service.internal/v1",
    "https://user:pass@translate.example.com/v1",
    "https://translate.example.com/v1?token=secret",
  ]) {
    assert.equal(
      validateMessageTranslationConfiguration(productionEnv({ MESSAGE_TRANSLATION_URL: url })).ok,
      false,
      url,
    );
  }
});

test("remote translation requires exact allowed origin and server credential", () => {
  assert.deepEqual(
    validateMessageTranslationConfiguration(
      productionEnv({ MESSAGE_TRANSLATION_ALLOWED_ORIGINS: "https://other.example.com" }),
    ),
    { ok: false, code: "translation_origin_not_allowed" },
  );
  assert.deepEqual(
    validateMessageTranslationConfiguration(productionEnv({ MESSAGE_TRANSLATION_TOKEN: "" })),
    { ok: false, code: "translation_token_missing" },
  );
  assert.equal(validateMessageTranslationConfiguration(productionEnv()).ok, true);
});

test("remote provider request is POST-only, no-store, refuses redirects and carries stable idempotency", async () => {
  const configuration = validateMessageTranslationConfiguration(productionEnv());
  assert.equal(configuration.ok, true);
  if (!configuration.ok) return;

  let captured: RequestInit | undefined;
  const fakeFetch: typeof fetch = async (_input, init) => {
    captured = init;
    return new Response(
      JSON.stringify({ requestId, translatedText: "Hola mundo", sourceLanguage: "en" }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const result = await executeMessageTranslation(
    { text: "Hello world", targetLanguage: "es", idempotencyKey: requestId },
    configuration,
    fakeFetch,
  );

  assert.equal(result.ok, true);
  assert.equal(captured?.method, "POST");
  assert.equal(captured?.redirect, "error");
  assert.equal(captured?.cache, "no-store");
  const headers = captured?.headers as Record<string, string>;
  assert.match(String(headers.Authorization), /^Bearer /);
  assert.equal(headers["Idempotency-Key"], requestId);
  assert.equal(headers["X-EntizNetStore-Translation-Idempotency-Key"], requestId);
  assert.equal(headers["X-EntizNetStore-Translation-Protocol"], "2");
  assert.doesNotMatch(String(captured?.body), /server-only-translation-token/);
  assert.equal(JSON.parse(String(captured?.body)).requestId, requestId);
});

test("the same provider idempotency key is reusable across crash-safe retries", async () => {
  const configuration = validateMessageTranslationConfiguration(productionEnv());
  assert.equal(configuration.ok, true);
  if (!configuration.ok) return;

  const seen: string[] = [];
  const fakeFetch: typeof fetch = async (_input, init) => {
    const headers = init?.headers as Record<string, string>;
    seen.push(headers["Idempotency-Key"]);
    return new Response(
      JSON.stringify({ requestId, translatedText: "Bonjour", sourceLanguage: "en" }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await executeMessageTranslation(
      { text: "Hello", targetLanguage: "fr", idempotencyKey: requestId },
      configuration,
      fakeFetch,
    );
    assert.equal(result.ok, true);
  }

  assert.deepEqual(seen, [requestId, requestId]);
});

test("provider must acknowledge the exact idempotency identity", async () => {
  const configuration = validateMessageTranslationConfiguration(productionEnv());
  assert.equal(configuration.ok, true);
  if (!configuration.ok) return;

  assert.deepEqual(
    await executeMessageTranslation(
      { text: "hello", targetLanguage: "fr", idempotencyKey: "not-a-uuid" },
      configuration,
      async () => new Response(null, { status: 500 }),
    ),
    { ok: false, code: "translation_idempotency_key_invalid" },
  );

  const wrongAck: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        requestId: "22222222-2222-4222-8222-222222222222",
        translatedText: "Bonjour",
        sourceLanguage: "en",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  assert.deepEqual(
    await executeMessageTranslation(
      { text: "hello", targetLanguage: "fr", idempotencyKey: requestId },
      configuration,
      wrongAck,
    ),
    { ok: false, code: "translation_provider_idempotency_ack_invalid" },
  );
});

test("provider response parsing rejects non-json, oversized and malformed translations", async () => {
  const configuration = validateMessageTranslationConfiguration(productionEnv());
  assert.equal(configuration.ok, true);
  if (!configuration.ok) return;

  const wrongType: typeof fetch = async () =>
    new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
  assert.deepEqual(
    await executeMessageTranslation(
      { text: "hello", targetLanguage: "fr", idempotencyKey: requestId },
      configuration,
      wrongType,
    ),
    { ok: false, code: "translation_provider_content_type_invalid" },
  );

  const tooLarge: typeof fetch = async () =>
    new Response(JSON.stringify({ requestId, translatedText: "x".repeat(40_000) }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  assert.deepEqual(
    await executeMessageTranslation(
      { text: "hello", targetLanguage: "fr", idempotencyKey: requestId },
      configuration,
      tooLarge,
    ),
    { ok: false, code: "translation_provider_response_too_large" },
  );
}