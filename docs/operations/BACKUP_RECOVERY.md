# Backup and recovery procedure

## Objective

EntizNetStore must be recoverable without relying on a developer laptop, old Replit state, or chat history. Supabase is the canonical backend. Git contains the ordered schema/migration history and deterministic reference seed; independent logical backups protect production data.

## Backup policy

### Before public launch

1. Keep every database change in a forward-only migration under `supabase/migrations`.
2. Keep deterministic non-secret reference data in `supabase/seed.sql`.
3. Produce an encrypted off-platform logical backup before destructive/high-risk database work and before releases that change commerce-critical schema.
4. Back up Supabase Storage objects separately; database backups contain Storage metadata, not the object bytes themselves.
5. Never commit database passwords, service-role keys, Stripe secrets, DeepL keys, or backup archives containing customer data.
6. Before real customer/payment data is accepted, move production to a backup posture with scheduled managed backups and an explicitly approved RPO/RTO. PITR is preferred once transaction volume justifies it.

### Manual logical backup

Run from a trusted operator environment with the Supabase CLI installed and authenticated:

```bash
supabase link --project-ref kllwwurklumhawfsilpd
mkdir -p .backups
supabase db dump --linked --file .backups/entiznetstore-$(date -u +%Y%m%dT%H%M%SZ).sql
```

If a connection URL is used instead, keep it in the shell/secret manager and never paste it into source control. Store the resulting dump encrypted in an access-controlled off-platform location. Record the UTC timestamp, Git commit SHA, project ref, and dump checksum alongside the archive.

Because Supabase Storage object bytes are not part of a database dump, export production buckets independently and retain a manifest containing bucket name, object path, size, and checksum.

## Pre-change verification

Before a high-risk migration:

- confirm the intended Git commit and migration list;
- capture row counts for commerce-critical tables;
- capture the current Supabase security and performance advisor state;
- confirm RLS remains enabled on every exposed table;
- confirm the backup file exists outside Supabase and its checksum can be read;
- for payment/order changes, verify there are no partially processed operations requiring reconciliation.

The initial M0 baseline is recorded in `PRODUCTION_BASELINE_2026-08-21.md`. At that point there were zero auth users, zero Storage objects and zero transactional rows, so the complete application data payload was the 22 reference rows preserved in `supabase/seed.sql`.

## Recovery to a fresh Supabase project

1. Create a new Supabase project in the approved production region.
2. Configure required project-level Auth/Storage settings without copying secrets into Git.
3. Check out the exact application release commit.
4. Link the CLI to the new project.
5. Apply migrations in repository order:

```bash
supabase db push
```

6. Apply deterministic seed/reference data when appropriate:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed.sql
```

7. Restore the latest production logical dump instead of the seed when recovering customer data. Follow Supabase's current dump/restore guidance and use a connection mode suitable for migration work.
8. Restore Storage objects and verify their paths/checksums.
9. Reconfigure deployment secrets from the approved secret manager/deployment platform.
10. Reconfigure Stripe webhook endpoints/secrets and any external provider callbacks.
11. Run the post-restore verification below before routing production traffic.

## Post-restore verification

### Database

- migration history exactly matches the release;
- all exposed tables have RLS enabled;
- RLS policies match the expected allowlist and deny-by-default tables remain private;
- `SECURITY DEFINER` functions have approved `search_path` and EXECUTE grants;
- foreign keys and performance indexes are present;
- row counts/reconciliation totals match the backup manifest.

### Commerce

- sign-up/sign-in/session recovery works;
- buyer and seller capabilities can coexist for one identity;
- seller ownership is enforced server-side;
- product creation/editing and inventory are correct;
- checkout idempotency works;
- Stripe webhook verification succeeds using a test event;
- orders cannot be read or transitioned by unrelated users;
- inventory reservations are released/finalized correctly on failure/success;
- admin-only operations reject non-admin identities.

### Application

Run at minimum:

```bash
npm ci
npm run typecheck
npm run build
```

Then execute the project's commerce/auth smoke or E2E suite available for that release.

## Recovery decision record

For each production recovery, record:

- incident/reason;
- backup timestamp and checksum;
- source and target Supabase project refs;
- application commit SHA;
- restore start/completion UTC timestamps;
- validation results;
- any data loss window;
- operator/reviewer;
- follow-up actions.

## Launch gate

A Free-plan project without an independently produced logical dump is not an acceptable final production backup strategy once real customer or payment data exists. Public launch remains blocked until the production backup tier/process and recovery test are explicitly completed.
