# EntizNetStore environment and secrets contract

Status: canonical for the M0 production foundation.

## Principles

- Git contains names and placeholders only. Real credentials must live in the deployment platform, CI secret store, or an approved local `.env.local` file.
- Any variable beginning with `NEXT_PUBLIC_` is treated as browser-visible and must never contain a secret.
- `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` are server-only. They must never be imported into Client Components, logged, returned by APIs, embedded in build artifacts, or copied into mobile clients.
- Local, preview, staging, and production environments use separate credentials where the provider supports it. Stripe must remain in test mode outside production.
- Rotate a credential immediately if it is committed, pasted into a public location, logged, or otherwise suspected of exposure.

## Required variables

| Variable | Scope | Required for | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser/server, public | auth + data clients | Supabase project URL. Safe to expose. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser/server, public | RLS-protected Supabase access | Public anon key; authorization still relies on RLS. |
| `SUPABASE_URL` | server | privileged server client | Normally the same project URL. Kept server-scoped to avoid privileged modules depending on browser config. |
| `SUPABASE_SERVICE_ROLE_KEY` | **server secret** | trusted admin/webhook operations | Bypasses RLS. Never expose to browsers/mobile clients. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | browser, public | Stripe Elements | Use `pk_test_...` outside production. |
| `STRIPE_SECRET_KEY` | **server secret** | payment-intent creation | Use `sk_test_...` outside production. |
| `STRIPE_WEBHOOK_SECRET` | **server secret** | Stripe webhook signature verification | Environment-specific `whsec_...`. |

No DeepL credential is part of the production contract. The legacy dynamic-translation proxy/cache path was removed in M0; EntizNetStore currently uses repository-backed static localization.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Fill the public Supabase values for the intended non-production project.
3. Add `SUPABASE_URL` and a non-production service-role key only when testing trusted server operations that require it.
4. Add Stripe **test** keys. Configure a test webhook endpoint and place its signing secret in `STRIPE_WEBHOOK_SECRET`.
5. Run `npm ci`, `npm run typecheck`, and `npm run build` before considering the environment reproducible.

`.env`, `.env.local`, and `.env.*.local` are gitignored. `.env.example` is intentionally committed and contains placeholders only.

## Deployment configuration

Production deploys must fail closed when a server secret needed by a requested feature is absent. Do not substitute mock credentials or bypass authorization to make a deployment appear healthy.

Recommended separation:

- **Preview:** preview/non-production Supabase project or branch and Stripe test mode.
- **Staging:** isolated staging Supabase project/branch and Stripe test mode with its own webhook secret.
- **Production:** canonical production Supabase project and Stripe live credentials only after the commerce launch gate is approved.

The production service-role key must be available only to server runtimes that need it. It is not a general application configuration value.

## Rotation procedure

For server secrets:

1. Create/rotate the credential at the provider.
2. Update the deployment secret store without committing the value.
3. Redeploy/restart affected server workloads.
4. Verify the relevant protected flow.
5. Revoke the old credential.
6. Record the rotation date and operator in the operational change record, never the secret itself.

For a suspected service-role leak, treat it as a high-severity incident because the key bypasses RLS. Rotate it first, then investigate logs/build artifacts and verify database authorization controls.

## CI

CI intentionally uses placeholder browser-safe Supabase values for compile/build validation. CI must not require production service-role or Stripe live secrets to type-check/build the application. Tests that exercise privileged or payment integrations must use dedicated test credentials supplied through CI secrets.
