# Address suggestion egress boundary

Status: production hardening contract (September 2026).

## Security and privacy objective

Registration address autocomplete is assistive only. The browser must never send a user's partial address directly to a third-party geocoder. Client code talks only to the same-origin EntizNetStore API. The trusted server adapter performs the minimum bounded upstream request needed to obtain suggestions.

The manually entered address remains authoritative for registration. Suggestions are not proof of residence, shipping validity, KYC evidence or a permission signal, and a provider outage must never prevent manual address entry or account creation.

## Browser boundary

`components/auth/AuthCard.tsx` POSTs `{ query }` to `/api/geo/address-suggest`.

- The address query is carried in a same-origin POST body rather than a browser request URL.
- Browser CSP therefore remains deny-by-default: no geocoding host is added to `connect-src`.
- No third-party geocoder receives the user's browser cookies, Supabase token, browser-origin Authorization header or direct browser network connection from this feature.
- Client code never reads geocoding credentials or provider configuration.

## Server request boundary

`lib/geo/addressSuggestions.ts` owns the external request contract.

- The production/demo adapter uses one fixed HTTPS origin: `https://photon.komoot.io`.
- The caller cannot supply or override a provider URL.
- Queries are normalized and bounded to 160 characters.
- At most five suggestions are requested and returned.
- Upstream redirects are rejected.
- Requests have a short timeout.
- Responses must be JSON and are bounded to 64 KiB before parsing.
- Returned labels are normalized, control characters removed, bounded and deduplicated.
- Application cookies, auth headers, user IDs, email addresses, phone numbers and forwarded client-IP headers are never propagated to the provider.
- Provider transport/protocol failure returns no suggestions. It does not cause registration to fail.

The current Photon endpoint is treated as a low-volume adapter, not an EntizNetStore trust or availability dependency. Before traffic requires a contractual geocoding SLA, replace the adapter with an approved service or a controlled deployment while preserving the same server-only interface and security constraints.

## Request API boundary

`POST /api/geo/address-suggest`:

- accepts only JSON;
- streams and bounds the complete request body to 1 KiB, including chunked bodies;
- rejects malformed UTF-8/JSON and oversized requests;
- returns only bounded suggestion strings and an availability flag;
- sends `Cache-Control: private, no-store, max-age=0` so partial address searches are not treated as shared-cache material.

No raw upstream payload, query text, browser cookie, token or address suggestion is written to application logs by this boundary.

## Deterministic regression provider

`ADDRESS_SUGGEST_PROVIDER=deterministic` exists only so CI can exercise keyboard and accessibility behavior without external network availability influencing the gate.

The deterministic provider is accepted only when `CI=true` and is explicitly rejected when `VERCEL_ENV=production`. Production otherwise defaults to the fixed server-side Photon adapter until a launch-grade provider is selected.

## Regression requirements

`npm run verify:foundation` proves that:

- Client Components contain no direct Photon origin.
- Auth autocomplete uses the same-origin POST endpoint.
- The server provider retains exact-origin, request/response-size, timeout and redirect controls.
- No browser-visible environment variable is used to configure server geocoder egress.
- The HTTP/Chromium/WCAG workflow uses the CI-only deterministic provider.
- Provider unit tests exercise query bounds, production fixture rejection, fixed-origin egress, metadata minimization, malformed responses and size failures.

Any future geocoder must preserve these properties instead of broadening browser CSP or accepting a caller-controlled outbound URL.
