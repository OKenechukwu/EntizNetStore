# EntizNetStore

EntizNetStore is the commerce marketplace in the Entiz ecosystem. This repository contains the production web marketplace and the canonical Supabase database/migration history. EntizNetStore remains a distinct product boundary while supporting secure EntizNet identity/capability integration.

## Current architecture

- **Web:** Next.js 16 + React 19 + TypeScript
- **Backend/database/auth/storage:** Supabase
- **Payments:** Stripe
- **Internationalization:** `next-intl` with optional server-side DeepL translation support
- **CI:** GitHub Actions (`npm ci`, TypeScript, production build, dependency audit)
- **Canonical database changes:** forward-only SQL migrations in `supabase/migrations`

Legacy Neon/Helium/Replit database/runtime assumptions are not part of the production architecture. Supabase is the canonical application backend.

## Prerequisites

- Node.js 22
- npm
- Supabase CLI for database migration/recovery work
- Access to the intended Supabase project
- Stripe credentials when testing payment flows

## Local setup

1. Clone the repository.
2. Copy `.env.example` to `.env.local` and populate only the values needed for the flows being tested.
3. Install locked dependencies:

```bash
npm ci
```

4. Start the application:

```bash
npm run dev
```

The default local URL is `http://localhost:3000` unless `PORT` is set.

## Required verification

Before merging production changes, run:

```bash
npm ci
npm run typecheck
npm run build
```

The pull-request CI runs the same locked install, typecheck, production build, and a high-severity production dependency audit.

## Database workflow

Supabase migration history is source-controlled. Never edit or replace a migration that has already been applied to the live project.

For a linked environment:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Create every schema/RLS/function/index change as a **new forward migration**. The repository migration versions are reconciled to the live migration history as part of M0 production hardening.

Reference seed data is stored in `supabase/seed.sql`. It is deterministic and contains no secrets or customer credentials.

## Security model

- RLS is enabled on every exposed `public` table.
- Tables without an approved client flow intentionally remain deny-by-default with RLS enabled and no allow policy.
- Seller/buyer ownership is enforced server-side and in RLS/RPC authorization.
- `SECURITY DEFINER` RPCs are explicitly allowlisted and audited; no anonymous access is permitted to privileged commerce/messaging RPCs.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never use a `NEXT_PUBLIC_*` name or enter a browser bundle.
- Payment webhooks verify Stripe signatures before database finalization.

See `docs/security/RLS_AND_SECURITY_DEFINER_AUDIT.md` for the current audited allowlist.

## Account capabilities

EntizNetStore does **not** model a user as one permanent exclusive role. A single identity may hold buyer, seller and future business capabilities at the same time. Capability profiles/state are authorization inputs; UI mode selection is not authorization.

See `docs/architecture/ADR-0001-account-capabilities.md`.

## Environment and secrets

See:

- `.env.example`
- `docs/operations/ENVIRONMENT_AND_SECRETS.md`

Do not commit real Supabase service-role keys, Stripe secrets, DeepL keys, database passwords, customer data exports, or production backup archives.

## Backup and recovery

Production recovery is documented in:

- `docs/operations/PRODUCTION_BASELINE_2026-08-21.md`
- `docs/operations/BACKUP_RECOVERY.md`

The live project was captured before M0 database mutation with zero auth users, zero Storage objects, zero transactional rows, and the complete 22-row reference data set preserved in `supabase/seed.sql`.

## Launch readiness

The canonical launch gate is maintained in `docs/LAUNCH_BLOCKERS.md`. A feature is not production-ready merely because it builds locally; core permissions, commerce failure states, payment idempotency/webhooks, recovery, observability and deployment configuration must be verified.

## Repository rules

1. Preserve useful existing behavior; prefer targeted changes over rewrites.
2. Treat Supabase and applied migrations as canonical backend state.
3. Use forward-only migrations.
4. Enforce ownership and authorization server-side.
5. Keep secrets out of source control and clients.
6. Keep documentation synchronized with architecture and operations.
7. Verify affected auth, catalog, seller, checkout, order, inventory, messaging and admin flows before release.
