# EntizNetStore — Canonical Launch Blockers

Last reviewed: **2026-08-21**

This document is the canonical launch-readiness record. A feature looking complete in the UI does not clear a blocker. A blocker is cleared only by verified production-safe behavior, authorization, failure handling, and relevant tests/evidence.

## Launch classifications

- **P0 — blocks accepting real customer/payment data or public commerce launch**
- **P1 — blocks polished public V1 / mobile parity but not internal engineering**
- **P2 — post-launch improvement or scale work**

Status values: `OPEN`, `IN PROGRESS`, `VERIFIED`, `DEFERRED`.

---

## M0 production-foundation exit gate

**Exit gate:** a fresh environment can reproduce production architecture safely.

| Item | Status | Evidence / remaining requirement |
| --- | --- | --- |
| Reconcile repository/live migration history | VERIFIED | Repository migration versions match live applied history; applied SQL was not rewritten. |
| Pre-change production recovery checkpoint | VERIFIED | Current application data captured in `supabase/seed.sql`; recovery runbook in `docs/operations/BACKUP_RECOVERY.md`. |
| Remove runtime Neon/Helium assumptions | VERIFIED | `npm run verify:foundation` scans executable runtime source and passed in CI; historical provenance inside already-applied migrations remains immutable. |
| Remove Replit runtime/debug assumptions | VERIFIED | `.replit`, Replit sidecar storage, and routable debug/dev/test surfaces removed; runtime client no longer depends on Replit preview behavior. |
| Remove unused legacy dependencies | VERIFIED | `package.json`/`package-lock.json` synchronized; clean locked `npm ci` and production dependency audit pass in CI. |
| Replace template README | VERIFIED | Production-oriented EntizNetStore README committed. |
| Environment/secrets contract | VERIFIED | `.env.example` + `docs/operations/ENVIRONMENT_SECRETS.md`. |
| Database security-advisor cleanup | VERIFIED WITH DOCUMENTED EXCEPTIONS | Remaining advisor entries are intentional deny-by-default tables and audited authenticated `SECURITY DEFINER` RPCs. |
| RLS audit | VERIFIED | All 27 exposed public tables have RLS enabled; intentional no-policy tables deny by default. |
| `SECURITY DEFINER` audit | VERIFIED | RPC execute grants and search paths explicitly controlled; webhook finalization remains service-role-only. |
| Performance indexes/policy optimization | VERIFIED | Missing FK indexes, auth-init-plan and overlapping permissive-policy warnings removed. |
| Capability architecture decision | VERIFIED | `docs/architecture/ADR-0001-account-capabilities.md`. |
| Backup/recovery procedure | VERIFIED | Operational runbook committed; managed backup requirement remains a separate P0 before customer/payment data. |
| Canonical launch blocker record | VERIFIED | This document. |
| Broken/legacy translation surfaces | VERIFIED | Orphaned dynamic cache endpoints, anonymous DeepL proxy, and client translation callers removed; static localization remains. |
| Clean dependency/install/build verification | VERIFIED | CI run #49 proved locked `npm ci`, production-foundation scan, TypeScript, and Next.js production build on commit `4f715ae475b477ae114089c3d9a682bb97773c91`. |
| Fresh database reproduction | VERIFIED | CI run #49 started a fresh PostgreSQL 17/Supabase stack, rebuilt from all migrations + seed, verified schema/RLS/RPC/index invariants, and shut down cleanly. Final reproduction assertions also cover the private `kyc-documents` storage bucket. |

**M0 status: VERIFIED.** The production-foundation exit gate is complete. M0 verification does **not** clear the independent P0 launch blockers below.

---

# P0 — blocks real customer/payment data or public commerce launch

## P0-01 — Durable production backups and tested restore

**Status: OPEN**

Current Supabase project is on a Free plan. Before any real customer, KYC, order, payment, or seller data is accepted, production must have an automated encrypted off-platform logical backup process and/or a Supabase tier with the required managed backup/PITR capability. A restore rehearsal must be recorded.

Owner evidence:
- backup schedule and retention;
- encrypted destination/access policy;
- successful restore rehearsal;
- recovery-point and recovery-time expectations.

## P0-02 — Production secret provisioning and rotation ownership

**Status: IN PROGRESS**

The secret contract is documented. Before launch, real production credentials must be provisioned in the deployment secret store, privilege-scoped, and ownership/rotation responsibility recorded. No production secret may live in Git or a browser/mobile bundle.

## P0-03 — Stripe end-to-end commerce verification

**Status: IN PROGRESS**

Verified repository/database layer:
- CI run #68 rebuilt a fresh PostgreSQL 17/Supabase environment and passed the P0 commerce/security regression suite;
- server-side price recalculation and multi-seller order splitting;
- checkout idempotency and changed-cart idempotency-key rejection;
- inventory reservation, consumption and cancellation/release;
- Stripe event replay deduplication and out-of-order `payment_failed`/`payment_intent.succeeded` safety;
- paid-state protection against late failure events;
- cross-account cancellation denial and seller fulfillment ownership/state transitions;
- live production P0 migrations applied and repository migration versions synchronized to production history.

Still required before real card processing:
- Stripe test-mode API/payment-intent exercise through the deployed application;
- webhook signature verification against actual Stripe test webhook delivery;
- controlled failure/retry verification at the HTTP boundary;
- refund/partial-refund behavior if exposed at launch;
- production reconciliation/audit procedure.

## P0-04 — Authorization/RLS regression suite

**Status: IN PROGRESS**

CI run #68 now provides automated buyer/seller/cross-account/service-role coverage for orders, order items, payment sessions, inventory reservations, escrow, checkout RPCs and fulfillment transitions. Live verification confirms all 27 public tables remain RLS-enabled, authenticated transaction readers have SELECT-only table privileges, raw webhook records remain API-inaccessible, `finalize_checkout_payment` remains service-role-only, and the service role has an explicit trusted-worker DML contract across the canonical schema.

Still required: representative automated anon/buyer/seller/cross-account/admin boundaries for catalog, profiles, messages, KYC, product uploads and remaining privileged routes/RPCs.

## P0-05 — Seller/admin/KYC/storage security completion

**Status: IN PROGRESS**

Verified implementation now includes:
- private `kyc-documents` Supabase Storage bucket with 10MB and PDF/JPEG/PNG/WebP restrictions;
- seller-scoped signed KYC upload/view brokerage through server authorization;
- KYC registration verifies the object exists, enforces actual downloaded byte size, and validates PDF/JPEG/PNG/WebP file signatures rather than trusting browser MIME/size claims;
- KYC approval maps correctly to seller `verified` state and requires all mandatory documents to be approved;
- public `product-media` Supabase Storage bucket with a 10MB JPEG/PNG/WebP contract;
- seller-scoped signed product-image upload initialization;
- product save verifies media belongs to the authenticated seller, is stored in the canonical bucket, exists, and has a valid image signature;
- the seller editor uses real signed Storage uploads instead of arbitrary external URLs/placeholders;
- the legacy direct browser multi-table product-write path redirects into the canonical atomic editor;
- removed images and deleted products clean owned Storage objects.

Still required before launch: complete route-level ownership regression coverage for all seller/admin/KYC/upload flows; verify recovery behavior under storage/database partial failures; define malware/content moderation handling; and verify remaining public-vs-signed media boundaries.

## P0-06 — Production deployment hardening

**Status: OPEN**

Verify:
- canonical production domain and HTTPS;
- deployment environment isolation;
- security headers/CSP appropriate to Stripe/Supabase;
- no debug/test/admin maintenance route accidentally public;
- structured error handling without secret leakage;
- health/deployment rollback procedure;
- database migration deployment procedure.

## P0-07 — Observability and commerce incident response

**Status: OPEN**

Production needs actionable monitoring for payment webhook failures, checkout/order inconsistencies, elevated server errors, auth/admin failures, storage failures, and database health. Define alert ownership and the first incident-response runbook.

## P0-08 — EntizNet identity/capability integration contract

**Status: OPEN for EntizNet entry; does not block standalone internal testing**

Before EntizNet-linked launch, implement and verify the secure identity/capability handoff described by ADR-0001. Standalone and EntizNet entry must resolve to the same identity/permissions without duplicated credentials or permanent single-role assumptions.

---

# P1 — blocks polished V1 / required product parity

## P1-01 — Native iOS/Android marketplace client

**Status: OPEN**

React Native + TypeScript mobile is a first-class launch commitment, not a web wrapper. Define the mobile app foundation, shared API/domain contracts, secure auth/session storage, catalog/cart/checkout/order/seller parity appropriate to V1, push/deep-link strategy, and App Store/Play readiness.

## P1-02 — Responsive/accessibility production pass

**Status: OPEN**

Verify core buyer/seller/admin flows across target viewport sizes, keyboard navigation, focus/error states, screen-reader semantics, contrast, loading/empty/error/recovery states, and touch ergonomics.

## P1-03 — Marketplace policy/operational content

**Status: OPEN**

Finalize the launch-required terms, privacy, returns/refunds, seller policies, prohibited/restricted products, age requirements, support/escalation paths, and any jurisdiction-specific commerce disclosures.

---

# Verification discipline

A blocker moves to `VERIFIED` only when the repository contains or links to reproducible evidence: tests, migration, runbook, CI run, deployment check, or recorded operational verification. Chat history is not the system of record.

When a blocker changes, update this file in the same development change whenever practical.
