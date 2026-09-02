# EntizNetStore environment and secrets contract

Status: canonical production environment contract.

## Principles

- Git contains names and placeholders only. Real credentials live in the deployment platform, CI secret store, or an approved local `.env.local` file.
- Any variable beginning with `NEXT_PUBLIC_` is browser-visible and must never contain a secret.
- `SUPABASE_SECRET_KEY`, legacy `SUPABASE_SERVICE_ROLE_KEY`, `UPLOAD_SCANNER_TOKEN`, and every payment/payout-provider secret or signing key are server-only. They must never be imported into Client Components, logged, returned by APIs, embedded in browser/static artifacts, or copied into mobile clients.
- Local, preview, staging, and production use separate credentials/projects where supported.
- Rotate a credential immediately if it is committed, pasted into a public location, logged, or otherwise suspected of exposure.
- EntizNetStore must remain safe when no payment or payout processor is configured. Processor onboarding is a launch gate, not a reason to ship mock money authorization.
- Uploads fail closed when malware scanning is missing or unhealthy; quarantine objects are never promoted merely because a scanner is unavailable.
- Search indexing remains fail-closed until the intentional public Web V1 launch.
- Browser network egress is deny-by-default. A new browser SDK must justify and explicitly declare each external origin rather than widening CSP to a scheme such as `https:` or `wss:`.

## Required core variables

| Variable | Scope | Required for | Notes |
| --- | --- | --- | --- |
| `SITE_INDEXING_ENABLED` | server/build configuration | public search indexing | Keep `false` until intentional public launch. Does not enable indexing by itself. |
| `PUBLIC_LAUNCH_CONFIRMATION` | server/build configuration, non-secret | second public-launch interlock | Keep `NOT_CONFIRMED`; production indexing additionally requires exact `ENTIZNETSTORE_PUBLIC_WEB_V1` and `VERCEL_ENV=production`. |
| `NEXT_PUBLIC_SUPABASE_URL` | browser/server, public | auth + RLS-protected Supabase access | Canonical project URL. Safe to expose. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser/server, public | **preferred** browser/SSR Supabase credential | Preferred current key for shipped clients. Authorization still relies on Auth/RLS/server authority. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser/server, public | legacy rollout fallback | Retained only while environments migrate to the publishable key. Remove after verified cutover. |
| `SUPABASE_URL` | server, non-secret | privileged server client | Normally the same project URL. Keeps privileged modules independent from browser config. |
| `SUPABASE_SECRET_KEY` | **server secret** | **preferred** privileged DB/storage/auth operations | Backend-only. Never expose through `NEXT_PUBLIC_*`. |
| `SUPABASE_SERVICE_ROLE_KEY` | **server secret** | legacy privileged-key fallback | Bypasses RLS. Retained only for controlled migration/rollback; remove after preferred key is proven. |
| `UPLOAD_SCANNER_MODE` | server configuration | upload safety | Production value is `remote`. `deterministic` is CI/local regression only and is rejected in production outside CI. |
| `UPLOAD_SCANNER_URL` | server configuration | remote malware scanner | Required for production upload acceptance; production requires HTTPS. |
| `UPLOAD_SCANNER_ALLOWED_ORIGINS` | server configuration | scanner egress pinning | Mandatory in production. Exact HTTPS origin allowlist; no path/query. |
| `UPLOAD_SCANNER_TOKEN` | **server secret** | authenticate remote scanner calls | Required in production remote mode. |
| `UPLOAD_SCANNER_TIMEOUT_MS` | server configuration | scanner timeout | Optional; bounded to 1000–30000ms, default 12000ms. |
| `PAYMENT_PROVIDER` | server configuration | buyer-payment adapter selection | Defaults to `unconfigured` until an approved processor is connected. |
| `NEXT_PUBLIC_PAYMENT_PROVIDER` | browser, public | checkout UX capability state | Provider identifier only; never credentials. |
| `PAYOUT_PROVIDER` | server configuration | seller-payout adapter selection | Defaults to `unconfigured`. |
| `PAYOUT_HOLD_DAYS` | server configuration | seller escrow release policy | Required only when a real payout adapter is enabled. Integer `0..365`; no production default. |

`VERCEL_ENV` is supplied by Vercel. It is not a manually invented launch flag.

Detailed Supabase key rollout and browser-egress procedure: `docs/operations/SUPABASE_KEY_MIGRATION_AND_BROWSER_EGRESS.md`.

## Supabase key migration contract

Browser/SSR code resolves credentials in this order:

1. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
2. legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` fallback.

Privileged server code resolves credentials in this order:

1. `SUPABASE_SECRET_KEY`;
2. legacy `SUPABASE_SERVICE_ROLE_KEY` fallback.

The fallbacks are migration controls, not permanent dual-key policy. Migrate Preview/Staging/Production independently, verify the exact deployment, then remove/revoke legacy credentials according to the operational runbook. Never remove a working production legacy key before the preferred-key deployment has been verified.

`scripts/verify-browser-egress-service-boundary.mjs` prevents Client Components from referencing privileged Supabase variables or importing privileged Supabase modules and checks browser artifacts for privileged names/values when chunks are present.

## Browser egress / CSP

Production `connect-src` is restricted to:

- `'self'` for EntizNetStore Route Handlers and same-origin APIs;
- the exact configured Supabase HTTP(S) origin;
- the exact corresponding Supabase WebSocket origin.

Scheme-wide `https:`, `http:`, `wss:` and `ws:` browser-connect permissions are forbidden. Current checkout initializes payment through same-origin APIs and follows an approved top-level provider redirect; it therefore does not require generic payment-provider `connect-src` access.

If a future browser integration genuinely requires another external origin, the change must add that exact origin, document why server-side mediation is unsuitable, and add regression coverage. Do not broaden CSP merely to silence a browser error.

## Payment-provider configuration

No Stripe credential is part of the canonical EntizNetStore environment contract while processor selection is deferred. Legacy package/database compatibility may remain temporarily during migration, but new application code uses the provider-neutral boundary in `docs/architecture/ADR-0002-payment-provider-boundary.md`.

When a buyer-payment processor is approved, its adapter documentation must add the exact provider-specific variables here. Secret API keys, merchant credentials and webhook signing secrets remain server-only and must not use `NEXT_PUBLIC_*` names.

With `PAYMENT_PROVIDER=unconfigured`:

- checkout presents a clear payment-activation-pending state;
- payment initialization and webhook routes fail closed;
- no external charge/payment request is attempted;
- no public fake-payment bypass is enabled;
- CI exercises provider-neutral success/failure/replay semantics against a disposable local database.

## Payout-provider configuration

The marketplace owns payout idempotency, escrow claims, normalized payout outcomes and reconciliation state as defined in `docs/architecture/ADR-0003-payout-provider-boundary.md`.

With `PAYOUT_PROVIDER=unconfigured`:

- payout requests fail closed before reserving escrow;
- payout webhooks fail closed;
- no external payout is initialized;
- held escrow is never marked released by a mock/fallback path;
- CI still exercises the internal payout ledger, terminal/retry behavior and concurrent escrow claiming.

When a payout adapter is enabled, `PAYOUT_HOLD_DAYS` becomes mandatory. Payout destination data stays server-side in Seller-private storage and must never be returned or logged.

## Upload quarantine and malware scanning

All untrusted KYC documents, product media, Seller branding and message attachments pass through the private `upload-quarantine` bucket before promotion. The trusted server validates file signatures and declared MIME, calculates SHA-256, obtains a scanner verdict, records bounded evidence, and promotes only a clean object into its final bucket.

Production rules:

- `UPLOAD_SCANNER_MODE=remote`;
- scanner URL must be HTTPS without embedded credentials, query strings or fragments;
- `UPLOAD_SCANNER_ALLOWED_ORIGINS` must contain the scanner's exact HTTPS origin;
- local/private hostname patterns and IP-literal scanner destinations are refused before egress;
- scanner token stays server-only;
- outgoing bytes are independently SHA-256 hashed;
- redirects are rejected;
- timeout, transport failure, non-2xx, oversized/malformed response or unknown verdict means unavailable and the upload is not promoted;
- blocked/invalid files are removed from quarantine;
- no API returns a final/public object reference before clean promotion finishes.

The deterministic scanner exists only to prove clean/blocked behavior (including EICAR) in local/CI regression. It is not production antivirus protection.

## Translation configuration

No dynamic message-translation provider credential is currently part of the production contract. Repository-backed static localization is the active baseline. When the V1 in-chat translation feature is implemented, its provider credential must be server-only and the provider contract must preserve the encrypted/canonical original message, use bounded outbound payloads, record provider/version metadata without exposing message plaintext in logs, and never make translated text the canonical dispute/moderation record.

## Public launch/indexing configuration

Search discoverability is governed by `lib/launch/publicIndexing.ts`. Indexing is enabled only when all three conditions hold:

- `VERCEL_ENV=production`;
- `SITE_INDEXING_ENABLED=true`;
- `PUBLIC_LAUNCH_CONFIRMATION=ENTIZNETSTORE_PUBLIC_WEB_V1`.

Before that state, root metadata, application response headers and `/robots.txt` remain noindex/disallow. Private route families remain non-indexable after public launch. Detailed procedure: `docs/operations/PUBLIC_LAUNCH_INTERLOCK.md`.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Keep indexing blocked locally.
3. Fill `NEXT_PUBLIC_SUPABASE_URL` and the publishable key for the intended non-production project; use the legacy anon key only when testing migration fallback.
4. Add `SUPABASE_URL` and a non-production secret key only when trusted server operations require it; use the legacy service-role key only for migration fallback.
5. For upload-safety work, use deterministic scanner mode only in local/CI regression or configure a dedicated non-production remote scanner.
6. Keep payment/payout providers unconfigured until intentionally testing approved adapters.
7. Run `npm ci`, `npm run verify:foundation`, `npm run typecheck`, and `npm run build` before treating the environment as reproducible.

`.env`, `.env.local`, and `.env.*.local` are gitignored. `.env.example` contains placeholders only.

## Deployment separation

- **Preview:** non-production Supabase project/branch where available; indexing blocked; payment/payout unconfigured unless isolated test accounts are deliberately attached.
- **Staging:** isolated staging Supabase project/branch; indexing blocked; dedicated authenticated remote scanner; approved payment/payout adapters use sandbox credentials.
- **Production:** canonical production Supabase project; indexing blocked until explicit launch interlock; authenticated allowlisted scanner required before public upload acceptance; payment/payout remain unconfigured until approved.

Privileged Supabase credentials must be available only to trusted server runtimes that need them. They are not general application configuration values.

## Rotation procedure

For server secrets:

1. Create/rotate the credential at the provider.
2. Update the deployment secret store without committing the value.
3. Redeploy/restart affected server workloads.
4. Verify the relevant protected flow and exact deployment.
5. Revoke the old credential.
6. Record the rotation date/operator without recording the secret.

Treat a suspected Supabase secret/service-role leak as high severity because privileged credentials bypass ordinary RLS boundaries. Rotate first, then investigate logs/build artifacts and re-verify database authorization controls.

For scanner/payment/payout secret leaks, disable or rotate at the provider, update the secret store, redeploy, and verify authenticated callbacks/flows before restoring the affected operation.

## CI

CI uses placeholder browser-safe Supabase values for compile/build validation and explicitly selects unconfigured payment/payout adapters. CI must not require production privileged Supabase credentials, live scanner credentials, or live provider secrets to type-check/build.

CI additionally proves:

- browser egress remains exact-origin rather than scheme-wide;
- Client Components cannot reference/import privileged Supabase boundaries;
- upload quarantine/scanning fail closed;
- public indexing remains blocked without all interlocks;
- provider-neutral payment/payout state transitions remain authoritative;
- fresh migrations reproduce identity, catalogue, wholesale, cart/order, financial and RLS/security invariants;
- authenticated HTTP/Chromium/WCAG gates cover critical launch flows.