# Backup and recovery procedure

Last reviewed: **2026-08-31**

## Objective

EntizNetStore must be recoverable without a developer laptop, old Replit state, or chat history. Supabase remains the canonical application backend. Git stores ordered forward migrations and deterministic application code; durable backups protect production data and Supabase Storage object bytes independently.

A migration replay is **not** a production backup. A backup is not trusted until it has been restored successfully into an isolated non-production target.

## Current production posture

Verified on 2026-08-31:

- canonical Store project ref: `kllwwurklumhawfsilpd` (`EntiznetStore_dev` in the Supabase dashboard);
- organization: `npteyrvjycunrveviodi` (`EntizNet`);
- database: PostgreSQL 17, `ACTIVE_HEALTHY`;
- auth users: 0;
- orders: 0;
- payment sessions: 0;
- payout requests: 0;
- KYC documents: 0;
- products: 0;
- Storage objects: 0.

This remains a safe pre-customer window. The project is production-canonical despite the historical dashboard name. Renaming is cosmetic and must not be used as a project-identity control; the immutable project ref is authoritative.

Supabase managed database backups do not restore Storage object bytes. Storage must therefore be backed up separately even when managed daily database backup or PITR is enabled.

## Recovery objectives

Launch engineering targets:

- database RPO: <= 24 hours with daily managed/off-platform backup; target <= 2 minutes if PITR is later enabled for live commerce;
- Storage RPO: <= 24 hours initially;
- SEV-1 database RTO: <= 4 hours for a recoverable database incident;
- Storage RTO: <= 8 hours, prioritizing private KYC/message objects where applicable.

These are engineering objectives, not contractual SLAs. Changes require an update here and in `LAUNCH_BLOCKERS.md`.

## Backup architecture

### Layer 1 — Supabase managed recovery

Use the approved Supabase plan's managed database backup capability. If PITR is enabled later, treat it as the fastest database rollback mechanism. Managed database backup is not the Storage-object backup layer and does not replace an independent encrypted export.

### Layer 2 — encrypted off-platform logical database backup

`.github/workflows/production-backup.yml` creates a Supabase-supported logical export using pinned Supabase CLI `2.111.0`:

1. `roles.sql` (`--role-only`);
2. `schema.sql`;
3. `data.sql` (`--data-only --use-copy`), intentionally excluding `storage.objects` plus vector Storage internals;
4. `history_schema.sql` and `history_data.sql` for `supabase_migrations` preservation.

The workflow does not commit dumps and does not retain them as GitHub Actions artifacts. The archive is encrypted with `age` before it leaves the ephemeral runner and is uploaded only to the configured S3-compatible off-platform backup destination. The destination object receives SHA-256 metadata, and the workflow performs a `head-object` readback to prove the durable object exists with the expected digest.

### Layer 3 — Supabase Storage object backup

`scripts/export-supabase-storage.mjs` uses the production service-role credential only inside the protected workflow runner. It:

- hard-binds the source URL to project ref `kllwwurklumhawfsilpd`;
- enumerates all Storage buckets and objects;
- downloads object bytes without making private buckets public;
- rejects path traversal;
- records bucket visibility and object size/content type/cache metadata;
- computes SHA-256 for every object;
- stores the object manifest only inside the encrypted backup archive.

Bucket/policy metadata remains in the database backup, but `storage.objects` rows are intentionally omitted from `data.sql`. The separate Storage manifest plus object bytes are the authority for object restoration. This prevents database-only “ghost” object rows from colliding with the verified byte upload during recovery.

## Required protected configuration

Create a GitHub Environment named `production-backup` with least-privilege access and the following values.

Secrets:

- `PRODUCTION_SUPABASE_DB_URL` — production database connection string suitable for Supabase CLI dump;
- `PRODUCTION_SUPABASE_URL` — exactly `https://kllwwurklumhawfsilpd.supabase.co`;
- `PRODUCTION_SUPABASE_SERVICE_ROLE_KEY` — server-only service-role key;
- `BACKUP_S3_ACCESS_KEY_ID`;
- `BACKUP_S3_SECRET_ACCESS_KEY`.

Environment variables:

- `BACKUP_AGE_RECIPIENT` — public `age1...` recipient; keep the private identity outside the production application and outside Supabase;
- `BACKUP_S3_BUCKET`;
- `BACKUP_S3_REGION`;
- `BACKUP_S3_PREFIX` — optional namespace such as `entiznetstore/production`;
- `BACKUP_S3_ENDPOINT` — optional HTTPS endpoint for an S3-compatible provider; leave empty for AWS S3.

The backup object store must be outside the Supabase project/account failure boundary, encryption-at-rest enabled, private, versioned or otherwise deletion-protected where available, and restricted to backup operators/workloads.

## Activation gate

The production backup workflow intentionally remains **manual-only** until off-platform credentials and encryption ownership are provisioned. This avoids a fake scheduled backup that fails permanently or silently writes nowhere.

Activation sequence:

1. provision the protected GitHub `production-backup` environment;
2. provision an S3-compatible private destination and retention/deletion controls;
3. generate an `age` key pair; store only the public recipient in GitHub variables and keep the private identity in an approved recovery secret store;
4. run `Production Backup` manually;
5. record the object key, workflow run, UTC time, Git SHA and encrypted archive SHA-256;
6. perform the restore rehearsal below;
7. only after both backup and restore are green, enable the desired recurring schedule in a follow-up PR.

A schedule must not be added before step 6 succeeds.

## Retention

Initial launch policy:

- daily encrypted logical + Storage backup: retain 30 days;
- weekly recovery point: retain 12 weeks;
- monthly recovery point: retain 12 months where customer/compliance policy permits;
- purge obsolete KYC/customer backup data in accordance with the final privacy/retention policy;
- never use indefinite retention as a substitute for policy.

Provider-side object lock/versioning is preferred for the short operational retention window if budget allows, with a break-glass deletion process.

## Restore rehearsal

`.github/workflows/restore-rehearsal.yml` is manual and destructive **only to the explicitly confirmed fresh disposable target**. It hard-refuses the production project ref, requires the operator to enter the recovery ref twice, and refuses a target that already contains EntizNetStore application tables, Auth users or Storage objects.

Required recovery environment values:

Secrets:

- `RECOVERY_SUPABASE_DB_URL`;
- `RECOVERY_SUPABASE_URL`;
- `RECOVERY_SUPABASE_SERVICE_ROLE_KEY`;
- `BACKUP_AGE_IDENTITY` — private identity matching the backup recipient;
- `BACKUP_S3_ACCESS_KEY_ID`;
- `BACKUP_S3_SECRET_ACCESS_KEY`.

Variables:

- `BACKUP_S3_BUCKET`;
- `BACKUP_S3_REGION`;
- `BACKUP_S3_ENDPOINT` when applicable.

The workflow:

1. refuses `kllwwurklumhawfsilpd` as a recovery target;
2. verifies the entered target ref equals the recovery Supabase URL, database connection and confirmation input;
3. proves the recovery project is blank of Store application tables, Auth users and Storage objects;
4. downloads the exact encrypted object and verifies its recorded SHA-256;
5. decrypts only on the ephemeral runner;
6. validates all internal backup checksums;
7. restores roles/schema/data and migration history using the Supabase-supported logical restore order;
8. restores Storage objects without overwrite and verifies every object checksum; because `storage.objects` data is excluded from the logical database dump, the upload recreates object metadata only when the bytes are actually present;
9. runs database/RLS/SECURITY DEFINER/M2/M3/M4A structural verification;
10. records recovery evidence in the workflow summary;
11. removes decrypted runner material even on failure.

Do not point this workflow at shared staging or a Supabase branch that already replayed EntizNetStore migrations. Use a fresh disposable recovery project. The workflow deliberately fails closed if the target is not blank.

## Pre-change backup gate

Before a high-risk production migration after real data exists:

- confirm the exact Git release SHA and migration set;
- confirm the latest durable backup object and checksum;
- confirm backup age is within RPO;
- capture commerce-critical row counts/reconciliation totals;
- capture security/performance advisor state;
- confirm all exposed tables retain RLS;
- confirm there are no unreconciled payment/order/payout operations requiring special handling.

## Post-restore verification

At minimum verify:

Database/security:

- migration ledger matches the intended release;
- exposed tables have RLS and expected policies/deny-by-default behavior;
- browser-callable `SECURITY DEFINER` RPCs remain the reviewed allow-list with hardened search paths;
- foreign keys/indexes are present;
- source/restore row counts and financial reconciliation totals match.

Commerce:

- Buyer/Seller/Business multi-capability authority;
- Seller ownership and product mutation boundaries;
- canonical retail + wholesale cart/checkout authority;
- checkout/payment idempotency;
- order/inventory reservation/finalization rules;
- Admin-only transitions;
- provider ledgers reconcile when providers are configured.

Storage:

- bucket public/private boundaries match the manifest;
- object count/size/SHA-256 match;
- KYC/message objects remain private;
- intentionally public product/store media remains limited to its intended bucket;
- signed private downloads remain owner-authorized and short-lived.

Application:

- exact production build succeeds;
- `/api/health` is healthy against the recovery environment if a recovery deployment is created;
- representative HTTP authorization/browser gates pass before recovered traffic is promoted.

## Evidence record

For every rehearsal or real recovery, record:

- reason/incident;
- source backup object key and SHA-256;
- source backup UTC timestamp;
- source application Git SHA;
- source and recovery project refs;
- restore start/completion UTC;
- measured RPO and RTO;
- database/Storage verification result;
- reconciliation differences, if any;
- operator/reviewer;
- disposal timestamp for restored sensitive data.

## P0-01 closure rule

P0-01 is not `VERIFIED` until all are true:

- managed and/or approved off-platform database backup posture is active;
- encrypted off-platform logical database backup is proven durable;
- Storage object-byte backup is proven durable;
- retention/encryption/access ownership is recorded;
- failed/missed-backup alerting is active when scheduling is enabled;
- at least one isolated restore rehearsal succeeds from the encrypted off-platform artifact;
- recovery evidence is committed to `docs/operations/` without secrets or customer content.
