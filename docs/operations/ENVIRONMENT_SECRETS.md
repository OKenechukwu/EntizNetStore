# EntizNetStore environment and secrets contract

Status: canonical production environment contract.

## Principles

- Git contains names and placeholders only. Real credentials must live in the deployment platform, CI secret store, or an approved local `.env.local` file.
- Any variable beginning with `NEXT_PUBLIC_` is browser-visible and must never contain a secret.
- `SUPABASE_SERVICE_ROLE_KEY` and every payment/payout-provider secret or signing key are server-only. They must never be imported into Client Components, logged, returned by APIs, embedded in build artifacts, or copied into mobile clients.
- Local, preview, staging, and production environments use separate credentials/projects where supported.
- Rotate a credential immediately if it is committed, pasted into a public location, logged, or otherwise suspected of exposure.
- EntizNetStore must remain safe when no payment or payout processor is configured. Processor onboarding is a launch gate, not a reason to ship mock money authorization.

## Required core variables

| Variable | Scope | Required for | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser/server, public | auth + data clients | Supabase project URL. Safe to expose. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser/server, public | RLS-protected Supabase access | Public anon key; authorization still relies on RLS. |
| `SUPABASE_URL` | server | privileged server client | Normally the same project URL. Kept server-scoped to avoid privileged modules depending on browser config. |
| `SUPABASE_SERVICE_ROLE_KEY` | **server secret** | trusted admin/payment/payout operations | Bypasses RLS. Never expose to browsers/mobile clients. |
| `PAYMENT_PROVIDER` | server configuration | buyer-payment adapter selection | Defaults to `unconfigured` until an approved processor is connected. |
| `NEXT_PUBLIC_PAYMENT_PROVIDER` | browser, public | checkout UX capability state | Defaults to `unconfigured`; contains only a provider identifier, never credentials. |
| `PAYOUT_PROVIDER` | server configuration | seller-payout adapter selection | Defaults to `unconfigured`; never causes an external transfer in that state. |
| `PAYOUT_HOLD_DAYS` | server configuration | seller escrow release policy | Required only when a real payout adapter is enabled. Integer `0..365`; intentionally has no production default. |

No Stripe credential is part of the canonical EntizNetStore environment contract while processor selection is deferred. Legacy Stripe code/database compatibility may remain temporarily during migration, but new application code must use the provider-neutral boundary in ADR-0002.

When a buyer-payment or seller-payout processor is approved, its adapter documentation must add the exact provider-specific variables here. Secret API keys, merchant credentials, webhook signing secrets and payout credentials must remain server-only and must not use `NEXT_PUBLIC_*` names.

No DeepL credential is part of the production contract. The legacy dynamic-translation proxy/cache path was removed in M0; EntizNetStore currently uses repository-backed static localization.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Fill the public Supabase values for the intended non-production project.
3. Add `SUPABASE_URL` and a non-production service-role key only when testing trusted server operations that require it.
4. Keep `PAYMENT_PROVIDER=unconfigured`, `NEXT_PUBLIC_PAYMENT_PROVIDER=unconfigured`, and `PAYOUT_PROVIDER=unconfigured` until intentionally testing approved adapters.
5. Add `PAYOUT_HOLD_DAYS` only when testing a payout adapter and an explicit hold policy has been chosen for that environment.
6. Run `npm ci`, `npm run typecheck`, and `npm run build` before considering the environment reproducible.

`.env`, `.env.local`, and `.env.*.local` are gitignored. `.env.example` is intentionally committed and contains placeholders only.

## Buyer payment-provider configuration

The marketplace commerce engine owns checkout idempotency, server-side pricing, inventory reservations, orders, normalized payment outcomes and escrow. External processors are adapters as defined in `docs/architecture/ADR-0002-payment-provider-boundary.md`.

With `PAYMENT_PROVIDER=unconfigured`:

- checkout presents a clear payment-activation-pending state;
- payment initialization and webhook routes fail closed with a controlled unavailable response;
- no external charge/payment request is attempted;
- no public fake-payment bypass is enabled;
- CI exercises provider-neutral success/failure/replay semantics against a disposable local database.

A provider may be enabled only after its legal/underwriting approval and adapter verification are complete. Provider-specific test/staging credentials must be different from production whenever the provider supports environment separation.

## Seller payout-provider configuration

The marketplace owns payout idempotency, escrow claims, normalized payout outcomes and reconciliation state as defined in `docs/architecture/ADR-0003-payout-provider-boundary.md`.

With `PAYOUT_PROVIDER=unconfigured`:

- the payout request route fails closed before reserving escrow;
- the payout webhook route fails closed;
- no external payout is initialized;
- held escrow is never marked released by a mock/fallback path;
- CI still exercises the complete internal payout ledger, terminal/retry behavior and concurrent escrow claiming against the disposable local database.

When a payout adapter is enabled, `PAYOUT_HOLD_DAYS` becomes mandatory. It controls the trusted-server eligibility cutoff; the database additionally requires paid + delivered + fulfilled orders, held escrow and no dispute. There is intentionally no built-in hold-period default because that duration is a marketplace business/risk decision.

Payout destination data stays in `profiles_seller_private` and is passed only to server-side adapters. It must never be returned by payout APIs or logged. A real adapter must use the internal `payoutRequestId` as its provider-side idempotency reference so ambiguous network timeouts can be retried without creating a duplicate disbursement.

## Deployment configuration

Production deploys must fail closed when a server secret needed by a requested feature is absent. Do not substitute mock credentials or bypass authorization to make a deployment appear healthy.

Recommended separation:

- **Preview:** non-production Supabase project/branch where available; payment and payout providers unconfigured unless isolated test accounts are deliberately attached.
- **Staging:** isolated staging Supabase project/branch; approved adapters using dedicated test/sandbox credentials and an explicitly chosen test hold period.
- **Production:** canonical production Supabase project; payment and payout providers remain unconfigured until their launch gates are approved, then receive production-only credentials and the approved payout hold policy.

The production service-role key must be available only to server runtimes that need it. It is not a general application configuration value. Provider secrets must follow the same least-privilege rule.

## Rotation procedure

For server secrets:

1. Create/rotate the credential at the provider.
2. Update the deployment secret store without committing the value.
3. Redeploy/restart affected server workloads.
4. Verify the relevant protected flow.
5. Revoke the old credential.
6. Record the rotation date and operator in the operational change record, never the secret itself.

For a suspected service-role leak, treat it as a high-severity incident because the key bypasses RLS. Rotate it first, then investigate logs/build artifacts and verify database authorization controls.

For a suspected payment/payout-provider secret or signing-key leak, disable or rotate the credential at the provider, update the deployment secret store, redeploy, and verify callback/webhook authentication before restoring money movement.

## CI

CI intentionally uses placeholder browser-safe Supabase values for compile/build validation and explicitly selects the `unconfigured` payment and payout adapters. CI must not require production service-role or live provider secrets to type-check/build the application.

Payment and payout behavior tests use disposable local database fixtures and normalized simulated provider references/events. They verify the internal money-state contracts without external network calls or production-accessible fake money endpoints. Payout CI additionally runs two concurrent database sessions against the same eligible escrow row to prove it cannot be claimed twice.
