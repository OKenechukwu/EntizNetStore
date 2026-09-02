import assert from "node:assert/strict";
import test from "node:test";
import {
  configuredAddressSuggestionProvider,
  fetchAddressSuggestions,
  normalizeAddressQuery,
} from "../lib/geo/addressSuggestions.ts";

test("address queries are normalized and bounded", () => {
  assert.equal(normalizeAddressQuery("  1   Session Road  "), "1 Session Road");
  assert.equal(normalizeAddressQuery("ab"), null);
  assert.equal(normalizeAddressQuery("x".repeat(161)), null);
  assert.equal(normalizeAddressQuery(null), null);
});

test("deterministic address provider is CI-only and never production", async () => {
  await assert.rejects(
    () =>
      fetchAddressSuggestions("Bag", {
        provider: "deterministic",
        env: { ADDRESS_SUGGEST_PROVIDER: "deterministic", CI: "false", VERCEL_ENV: "preview" },
      }),
    /deterministic_address_suggest_forbidden/,
  );
  await assert.rejects(
    () =>
      fetchAddressSuggestions("Bag", {
        provider: "deterministic",
        env: { ADDRESS_SUGGEST_PROVIDER: "deterministic", CI: "true", VERCEL_ENV: "production" },
      }),
    /deterministic_address_suggest_forbidden/,
  );

  const suggestions = await fetchAddressSuggestions("Bag", {
    provider: "deterministic",
    env: { ADDRESS_SUGGEST_PROVIDER: "deterministic", CI: "true", VERCEL_ENV: "preview" },
  });
  assert.deepEqual(suggestions, [
    "1 Session Road, Baguio City, Philippines",
    "2 Burnham Park, Baguio City, Philippines",
  ]);
});

test("Photon egress is fixed-origin, bounded, non-redirecting and credential-free", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    capturedUrl = input instanceof URL ? input.toString() : String(input);
    capturedInit = init;
    return new Response(
      JSON.stringify({
        features: [
          { properties: { label: " 1 Session Road\nBaguio City " } },
          { properties: { label: "1 Session Road Baguio City" } },
          { properties: { name: "Burnham Park" } },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const suggestions = await fetchAddressSuggestions("Baguio", {
    provider: "photon_demo",
    fetchImpl,
    env: { ADDRESS_SUGGEST_PROVIDER: "photon_demo", CI: "true", VERCEL_ENV: "preview" },
  });

  const url = new URL(capturedUrl);
  assert.equal(url.origin, "https://photon.komoot.io");
  assert.equal(url.pathname, "/api/");
  assert.equal(url.searchParams.get("q"), "Baguio");
  assert.equal(url.searchParams.get("limit"), "5");
  assert.equal(capturedInit?.method, "GET");
  assert.equal(capturedInit?.redirect, "error");
  assert.equal(capturedInit?.cache, "no-store");

  const headers = new Headers(capturedInit?.headers);
  assert.equal(headers.get("authorization"), null);
  assert.equal(headers.get("cookie"), null);
  assert.equal(headers.get("x-forwarded-for"), null);
  assert.deepEqual(suggestions, ["1 Session Road Baguio City", "Burnham Park"]);
});

test("Photon responses fail closed on bad status, non-JSON and oversized payloads", async () => {
  const env = { ADDRESS_SUGGEST_PROVIDER: "photon_demo", CI: "true", VERCEL_ENV: "preview" };

  await assert.rejects(
    () =>
      fetchAddressSuggestions("Baguio", {
        provider: "photon_demo",
        env,
        fetchImpl: async () => new Response("nope", { status: 503 }),
      }),
    /address_provider_unavailable/,
  );

  await assert.rejects(
    () =>
      fetchAddressSuggestions("Baguio", {
        provider: "photon_demo",
        env,
        fetchImpl: async () =>
          new Response("<html></html>", {
            status: 200,
            headers: { "content-type": "text/html" },
          }),
      }),
    /address_provider_invalid_content_type/,
  );

  await assert.rejects(
    () =>
      fetchAddressSuggestions("Baguio", {
        provider: "photon_demo",
        env,
        fetchImpl: async () =>
          new Response("{}", {
            status: 200,
            headers: {
              "content-type": "application/json",
              "content-length": String(70 * 1024),
            },
          }),
      }),
    /address_provider_response_too_large/,
  );
});

test("configured provider rejects unknown values", () => {
  assert.equal(configuredAddressSuggestionProvider({}), "photon_demo");
  assert.equal(
    configuredAddressSuggestionProvider({ ADDRESS_SUGGEST_PROVIDER: "deterministic" }),
    "deterministic",
  );
  assert.throws(
    () => configuredAddressSuggestionProvider({ ADDRESS_SUGGEST_PROVIDER: "https://attacker.test" }),
    /address_suggest_provider_invalid/,
  );
});
