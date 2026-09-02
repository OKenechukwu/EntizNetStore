import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateRequestIntegrity,
  REQUEST_INTEGRITY_EXEMPT_PATHS,
  resolveRequestOrigin,
} from "../lib/security/requestIntegrity.ts";

const requestOrigin = "https://store.example.com";

function evaluate(overrides: Partial<Parameters<typeof evaluateRequestIntegrity>[0]> = {}) {
  return evaluateRequestIntegrity({
    method: "POST",
    pathname: "/api/buyer/addresses",
    requestOrigin,
    originHeader: requestOrigin,
    secFetchSite: "same-origin",
    ...overrides,
  });
}

test("safe API methods are unaffected by cross-site browser metadata", () => {
  assert.deepEqual(
    evaluate({ method: "GET", originHeader: "https://attacker.example", secFetchSite: "cross-site" }),
    { allowed: true, protected: false, exempt: false },
  );
});

test("same-origin browser mutations are allowed", () => {
  assert.deepEqual(evaluate(), { allowed: true, protected: true, exempt: false });
});

test("browser-facing Host resolves a Next.js runtime host alias without weakening exact-origin proof", () => {
  const browserFacingOrigin = resolveRequestOrigin({
    requestOrigin: "http://localhost:3000",
    hostHeader: "127.0.0.1:3000",
  });
  assert.equal(browserFacingOrigin, "http://127.0.0.1:3000");
  assert.deepEqual(
    evaluate({
      requestOrigin: browserFacingOrigin,
      originHeader: "http://127.0.0.1:3000",
      secFetchSite: "same-origin",
    }),
    { allowed: true, protected: true, exempt: false },
  );
});

test("malformed or ambiguous Host input cannot create a permissive origin target", () => {
  for (const hostHeader of [
    "store.example.com,attacker.example",
    "user@store.example.com",
    "store.example.com/path",
    "store.example.com?x=1",
  ]) {
    assert.equal(
      resolveRequestOrigin({ requestOrigin, hostHeader }),
      requestOrigin,
      hostHeader,
    );
  }

  const decision = evaluate({
    requestOrigin: resolveRequestOrigin({
      requestOrigin,
      hostHeader: "store.example.com,attacker.example",
    }),
    originHeader: "https://attacker.example",
    secFetchSite: "same-origin",
  });
  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.reason, "origin_mismatch");
});

test("cross-site browser mutations are rejected before route authentication", () => {
  const decision = evaluate({
    originHeader: "https://attacker.example",
    secFetchSite: "cross-site",
  });
  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.reason, "cross_site");
});

test("an origin mismatch is rejected even without Fetch Metadata", () => {
  const decision = evaluate({
    originHeader: "https://attacker.example",
    secFetchSite: null,
  });
  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.reason, "origin_mismatch");
});

test("null, credentialed, path-bearing and malformed Origin values are rejected", () => {
  for (const originHeader of [
    "null",
    "https://user:pass@store.example.com",
    "https://store.example.com/path",
    "not-an-origin",
  ]) {
    const decision = evaluate({ originHeader, secFetchSite: null });
    assert.equal(decision.allowed, false, originHeader);
    if (!decision.allowed) assert.equal(decision.reason, "invalid_origin", originHeader);
  }
});

test("same-site browser mutations without an exact Origin proof are rejected", () => {
  const decision = evaluate({ originHeader: null, secFetchSite: "same-site" });
  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.reason, "same_site_without_origin");
});

test("non-browser mutations without browser provenance headers remain available to authenticated services", () => {
  assert.deepEqual(
    evaluate({ originHeader: null, secFetchSite: null }),
    { allowed: true, protected: true, exempt: false },
  );
});

test("cryptographically authenticated cross-site ingress uses exact path exemptions", () => {
  const expected = [
    "/api/integrations/entiznet/handoff",
    "/api/payments/webhook",
    "/api/payments/payout-webhook",
  ];
  assert.deepEqual([...REQUEST_INTEGRITY_EXEMPT_PATHS], expected);

  for (const pathname of expected) {
    assert.deepEqual(
      evaluate({ pathname, originHeader: "https://external.example", secFetchSite: "cross-site" }),
      { allowed: true, protected: true, exempt: true },
      pathname,
    );
  }

  const childPath = evaluate({
    pathname: "/api/payments/webhook/untrusted-child",
    originHeader: "https://external.example",
    secFetchSite: "cross-site",
  });
  assert.equal(childPath.allowed, false);
});
