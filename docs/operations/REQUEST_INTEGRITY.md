# Browser Request-Integrity Boundary

EntizNetStore uses Supabase cookie-backed browser sessions for authenticated marketplace operations. Route authorization and Supabase RLS remain the primary ownership boundary, but cookie authentication also requires an explicit cross-site request-integrity defense for state-changing browser requests.

## Policy

`proxy.ts` evaluates every `POST`, `PUT`, `PATCH` and `DELETE` under `/api/` before the Supabase session refresher or route handler can perform a side effect.

For ordinary browser mutations:

- `Sec-Fetch-Site: cross-site` is rejected;
- an `Origin` header, when present, must be a syntactically exact HTTP(S) origin and must equal the request origin;
- `Origin: null`, credential-bearing origins, path-bearing origins and malformed origins are rejected;
- `Sec-Fetch-Site: same-site` without an exact `Origin` proof is rejected because a sibling subdomain is not equivalent to same-origin;
- requests carrying neither browser provenance header remain available to non-browser service/provider clients, which must still pass their route-specific authentication or signature checks.

Rejected requests return HTTP 403 with a generic body and `Cache-Control: no-store` before session refresh.

## Cross-site ingress exemptions

Cross-site ingress is not exempted by broad route prefixes. The only exact-path exemptions are:

- `/api/integrations/entiznet/handoff` — authenticated by the short-lived signed EntizNet assertion and replay ledger;
- `/api/payments/webhook` — authenticated by the configured payment-provider webhook contract;
- `/api/payments/payout-webhook` — authenticated by the configured payout-provider webhook contract.

These exact-path exemptions prevent the browser CSRF boundary from breaking legitimate provider or EntizNet ingress while avoiding a wildcard bypass for neighboring APIs. Any future cross-site browser/server ingress must have an independent authenticated integrity contract before it is added to this list.

## What this does not replace

This boundary **does not replace authorization or RLS**. Every protected route must still authenticate the caller, enforce capability/ownership server-side, validate inputs and rely on the canonical database authority. Payment and payout callbacks must still verify their provider authenticity, and EntizNet handoff must still verify signature, audience, expiry and replay state.

The guard also does not replace Next.js Server Action protections. It is intentionally scoped to `/api/` mutation handlers, where EntizNetStore has Buyer, Seller, BSM, messaging, checkout, KYC and Admin APIs backed by cookie sessions.

## Verification

`tests/request-integrity.test.mts` freezes same-origin acceptance, cross-site denial, malformed/mismatched Origin denial, same-site sibling-host behavior, non-browser compatibility and the exact exemption set. `scripts/verify-request-integrity-foundation.mjs` ensures the policy remains wired ahead of Supabase session refresh. The production HTTP smoke sends a harmless anonymous cross-site `PATCH` to `/api/buyer/profile`; a healthy deployment must return 403 at the proxy boundary rather than falling through to route authentication.
