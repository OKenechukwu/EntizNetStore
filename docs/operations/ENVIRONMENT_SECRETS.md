# EntizNetStore environment and secrets contract

Status: canonical production environment contract.

## Principles

- Git contains names and placeholders only. Real credentials must live in the deployment platform, CI secret store, or an approved local `.env.local` file.
- Any variable beginning with `NEXT_PUBLIC_` is browser-visible and must never contain a secret.
- `SUPABASE_SERVICE_ROLE_KEY` and every payment-provider secret/signing key are server-only. They must never be imported into Client Components, logged, returned by APIs, embedded in build artifacts, or copied into mobile clients.
- Local, preview, staging, and production environments use separate credentials/projects where supported.
- Rotate a credential immediately if it is committed, pasted into a public location, logged, or otherwise suspected of exposure.
- EntizNetStore must remain safe when no payment processor is configured. Processor onboarding is a launch gate, not a reason to ship mock payment authorization.

## Required core variables

| Variable | Scope | Required for | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser/server, public | auth + data clients | Supabase project URL. Safe to expose. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser/server, public | RLS-protected Supabase access | Public anon key; authorization still relies on RLS. |
| `SUPABASE_URL` | server | privileged server client | Normally the same project URL. Kept server-scoped to avoid privileged modules depending on browser config. |
| `SUPABASE_SERVICE_ROLE_KEY` | **server secret** | trusted admin/payment-webhook operations | Bypasses RLS. Never expose to browsers/mobile clients. |
| `PAYMENT_PROVIDER` | server configuration | payment adapter selection | Defaults to `unconfigured` until an approved processor is connected. |
| `NEXT_PUBLIC_PAYMENT_PROVIDER` | browser, public | checkout UX capability state | Defaults to `unconfigured`; contains only a provider identifier, never credentials. |

No Stripe credential is part of the canonical EntizNetStore environment contract while processor selection is deferred. Legacy Stripe code/database compatibility may remain temporarily during migration, but new application code must use the provider-neutral boundary in ADR-0002.

When a processor is approved, its adapter documentation must add the exact provider-specific variables here. Secret API keys, merchant credentials, webhook signing secrets and payout credentials must remain server-only and must not use `NEXT_PUBLIC_*` names.

No DeepL credential is part of the production contract. The legacy dynamic-translation proxy/cache path was removed in M0; EntizNetStore currently uses repository-backed static localization.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Fill the public Supabase values for the intended non-production project.
3. Add `SUPABASE_URL` and a non-production service-role key only when testing trusted server operations that require it.
4. Keep `PAYMENT_PROVIDER=unconfigured` and `NEXT_PUBLIC_PAYMENT_PROVIDER=unconfigured` until intentionally testing an approved adapter.
5. Run `npm ci`, `npm run typecheck`, and `npm run build` before considering the environment reproducible.

`.env`, `.env.local`, and `.env.*.local` are gitignored. `.env.example` is intentionally committed and contains placeholders only.

## Payment-provider configuration

The marketplace commerce engine owns checkout idempotency, server-side pricing, inventory reservations, orders, normalized payment outcomes and escrow. External processors are adapters as defined in `docs/architecture/ADR-0002-payment-provider-boundary.md`.

With `PAYMENT_PROVIDER=unconfigured`:

- checkout presents a clear payment-activation-pending state;
- payment initialization and webhook routes fail closed with a controlled unavailable response;
- no external charge/payment request is attempted;
- no public fake-payment bypass is enabled;
- CI exercises provider-neutral success/failure/replay semantics against a disposable local database.

A provider may be enabled only after its legal/underwriting approval and adapter verification are complete. Provider-specific test/staging credentials must be different from production whenever the provider supports environment separation.

## Deployment configuration

Production deploys must fail closed when a server secret needed by a requested feature is absent. Do not substitute mock credentials or bypass authorization to make a deployment appear healthy.

Recommended separation:

- **Preview:** non-production Supabase project/branch where available; payment provider unconfigured unless an isolated test account is deliberately attached.
- **Staging:** isolated staging Supabase project/branch; approved payment adapter using dedicated test/sandbox credentials.
- **Production:** canonical production Supabase project; payment provider remains unconfigured until the real processor launch gate is approved, then receives production-only merchant/webhook credentials.

The production service-role key must be available only to server runtimes that need it. It is not a general application configuration value. Payment provider secrets must follow the same least-privilege rule.

## Rotation procedure

For server secrets:

1. Create/rotate the credential at the provider.
2. Update the deployment secret store without committing the value.
3. Redeploy/restart affected server workloads.
4. Verify the relevant protected flow.
5. Revoke the old credential.
6. Record the rotation date and operator in the operational change record, never the secret itself.

For a suspected service-role leak, treat it as a high-severity incident because the key bypasses RLS. Rotate it first, then investigate logs/build artifacts and verify database authorization controls.

For a suspected payment-provider secret/signing-key leak, disable or rotate the credential at the provider, update the deployment secret store, redeploy, and verify callback/webhook authentication before restoring payment traffic.

## CI

CI intentionally uses placeholder browser-safe Supabase values for compile/build validation and explicitly selects the `unconfigured` payment adapter. CI must not require production service-role or live payment-provider secrets to type-check/build the application.

Payment behavior tests use disposable local database fixtures and normalized simulated provider references/events. They verify the internal money-state contract without making external network calls or creating a production-accessible fake payment endpoint.
