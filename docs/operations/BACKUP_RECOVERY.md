# Backup and recovery procedure

Last reviewed: **2026-08-25**

## Objective

EntizNetStore must be recoverable without relying on a developer laptop, old Replit state, or chat history. Supabase is the canonical backend. Git contains the ordered schema/migration history and deterministic reference seed; independent logical backups protect production data.

## Live production backup posture

As verified through the connected Supabase project on **2026-08-25**:

- production project: `kllwwurklumhawfsilpd`;
- organization: `qjvapaxlsnhrkmktizix` (`EntizNetStore`);
- organization plan: **Free**;
- database status: `ACTIVE_HEALTHY`, PostgreSQL 17;
- auth users: 0;
- orders: 0;
- payment sessions: 0;
- payout requests: 0;
- KYC documents: 0;
- products: 0;
- Storage objects: 0.

This is a safe pre-customer window, but it is **not an acceptable final public-commerce backup posture**. Current Supabase guidance states that managed daily backups are automatically available for Pro, Team and Enterprise projects, while Free projects should regularly export data with `supabase db dump` and maintain off-site backups. Supabase database backups also contain Storage metadata rather than the Storage object bytes, so object backup is a separate requirement.

Before accepting real customer/KYC/order/payment/Seller data, production must either be moved/upgraded to an organization/tier with the approved managed backup posture or have an equally durable independent encrypted backup system in place. The final choice must be recorded with retention, access ownership, RPO and RTO.

## Backup policy

### Before public launch

1. Keep every database change in a forward-only migration under `supabase/migrations`.
2. Keep deterministic non-secret reference data in `supabase/seed.sql`.
3. Produce an encrypted off-platform logical backup before destructive/high-risk database work and before releases that change commerce-critical schema.
4. Back up Supabase Storage objects separately; database backups contain Storage metadata, not the object bytes themselves.
5. Never commit database passwords, service-role keys, provider secrets, or backup archives containing customer data.
6. Move production off the current Free-plan backup posture before real customer data is accepted.
7. At minimum, enable managed daily database backups with documented retention and keep an independent encrypted logical backup outside the Supabase project/account boundary.
8. For a real transactional marketplace, enable PITR when the approved operating budget/tier is provisioned so database recovery is measured in minutes rather than a full daily-backup interval.
9. Retain an independently verifiable Storage object manifest and object backup because database/PITR recovery alone cannot restore deleted Storage object bytes.

## Proposed launch recovery objectives

These targets become binding once the production backup tier is approved:

- **Database RPO:** target ≤ 2 minutes with PITR for live commerce; temporary pre-PITR maximum must never exceed the verified managed/off-platform backup interval.
- **Storage RPO:** target ≤ 24 hours initially, with more frequent replication for KYC/message attachments if customer volume or compliance risk requires it.
- **SEV-1 database RTO:** target ≤ 4 hours for a recoverable database incident, excluding provider-wide outages outside our control.
- **Storage recovery RTO:** target ≤ 8 hours for full restore, with critical KYC/message objects prioritized.

These are engineering targets, not contractual SLAs. Record any approved change in this file and `LAUNCH_BLOCKERS.md`.

### Manual logical backup

Run from a trusted operator environment with the Supabase CLI installed and authenticated:

```bash
supabase link --project-ref kllwwurklumhawfsilpd
mkdir -p .backups
supabase db dump --linked --file .backups/entiznetstore-$(date -u +%Y%m%dT%H%M%SZ).sql
```

If a connection URL is used instead, keep it in the shell/secret manager and never paste it into source control. Store the resulting dump encrypted in an access-controlled off-platform location. Record the UTC timestamp, Git commit SHA, project ref, and dump checksum alongside the archive.

Because Supabase Storage object bytes are not part of a database dump, export production buckets independently and retain a manifest containing bucket name, object path, size, checksum and backup timestamp.

## Automated off-platform backup requirements

The final scheduled backup job must:

- run from controlled infrastructure with secrets supplied only by the deployment/CI secret store;
- dump database roles/schema/data using the currently supported Supabase/Postgres backup method;
- encrypt artifacts before durable off-platform retention where the destination does not already provide equivalent encryption and access controls;
- back up Storage object bytes separately from database metadata;
- create checksums/manifests and record success/failure without logging credentials or sensitive payload content;
- alert on missed/failed backups;
- apply a documented retention policy rather than keeping unbounded customer/KYC archives;
- support periodic restore rehearsal into a non-production recovery project/environment.

Do not activate a scheduled production backup workflow that references unset secrets: a permanently failing workflow is not a backup system. Provision the production tier/destination/credentials first, then enable and verify the schedule.

## Pre-change verification

Before a high-risk migration:

- confirm the intended Git commit and migration list;
- capture row counts for commerce-critical tables;
- capture the current Supabase security and performance advisor state;
- confirm RLS remains enabled on every exposed table;
- confirm the backup file exists outside Supabase and its checksum can be read;
- for payment/order changes, verify there are no partially processed operations requiring reconciliation.

The initial M0 baseline is recorded in `PRODUCTION_BASELINE_2026-08-21.md`. The 2026-08-25 live check again confirmed zero auth users, transactional rows in the listed commerce tables, and Storage objects, so there is no existing customer-data restore obligation yet. Reference data remains reproducible from repository migrations/seed.

## Recovery to a fresh Supabase project

1. Create a new Supabase project in the approved production region/tier.
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
10. Reconfigure payment/payout webhook endpoints/secrets and any external provider callbacks.
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
- Buyer and Seller capabilities can coexist for one identity;
- Seller ownership is enforced server-side;
- product creation/editing and inventory are correct;
- checkout idempotency works;
- selected payment-provider webhook verification succeeds using a sandbox/test event;
- orders cannot be read or transitioned by unrelated users;
- inventory reservations are released/finalized correctly on failure/success;
- Admin-only operations reject non-Admin identities;
- payment/refund/payout/escrow ledgers reconcile to external provider state where configured.

### Storage

- required buckets exist with the intended public/private boundary;
- restored object count and checksums match the backup manifest;
- KYC and message attachments remain private;
- Seller branding/product-media public access is limited to intentionally public assets;
- signed private downloads remain short-lived and ownership-authorized.

### Application

Run at minimum:

```bash
npm ci
npm run typecheck
npm run build
```

Then run the release's database, HTTP authorization and production smoke suites as applicable before routing traffic.

## Restore rehearsal

Before public launch and periodically afterwards:

1. choose a known backup snapshot and record its checksum;
2. restore into a disposable non-production Supabase recovery project/environment;
3. restore the matching Storage object snapshot;
4. execute database structural/RLS regressions and representative HTTP authorization checks;
5. reconcile row/object counts and commerce ledger totals;
6. record actual recovery duration, any data-loss window and problems found;
7. destroy the recovery environment safely after evidence is retained and sensitive restored data is no longer required.

A backup that has never been successfully restored is not considered verified recovery capability.

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

The currently verified Free-plan project is not an acceptable final production backup strategy once real customer, KYC, order or payment data exists. Public launch remains blocked until all of the following are true:

- approved managed/off-platform database backup posture is active;
- Storage object backup is active;
- retention/access ownership and RPO/RTO are recorded;
- backup failure alerting works;
- at least one restore rehearsal has succeeded and its evidence is recorded.
