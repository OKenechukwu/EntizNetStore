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
| Remove runtime Neon/Helium assumptions | IN PROGRESS | Final repository residue scan required before M0 sign-off. Historical provenance inside already-applied migrations may remain immutable. |
| Remove Replit runtime/debug assumptions | VERIFIED | `.replit` and routable debug/dev/test surfaces removed; runtime client no longer depends on Replit preview behavior. |
| Remove unused legacy dependencies | IN PROGRESS | `package.json` cleaned; `package-lock.json` synchronization + clean `npm ci` verification still required. |
| Replace template README | VERIFIED | Production-oriented EntizNetStore README committed. |
| Environment/secrets contract | VERIFIED | `.env.example` + `docs/operations/ENVIRONMENT_SECRETS.md`. |
| Database security-advisor cleanup | VERIFIED WITH DOCUMENTED EXCEPTIONS | Remaining advisor entries are intentional deny-by-default tables and audited authenticated `SECURITY DEFINER` RPCs. |
| RLS audit | VERIFIED | All 27 exposed public tables have RLS enabled; intentional no-policy tables deny by default. |
| `SECURITY DEFINER` audit | VERIFIED | RPC execute grants and search paths explicitly controlled; webhook finalization remains service-role-only. |
| Performance indexes/policy optimization | VERIFIED | Missing FK indexes, auth-init-plan and overlapping permissive-policy warnings removed. |
| Capability architecture decision | VERIFIED | `docs/architecture/ADR-0001-account-capabilities.md`. |
| Backup/recovery procedure | VERIFIED | Operational runbook committed; managed backup requirement remains a separate P0 before customer/payment data. |
| Canonical launch blocker record | VERIFIED | This document. |
| Broken/legacy translation surfaces | VERIFIED | Orphaned dynamic cache endpoints and unauthenticated DeepL proxy removed; static localization remains. |
| Clean dependency/install/build verification | OPEN | Synchronize lockfile; prove `npm ci`, typecheck and production build from locked dependencies. |
| Fresh database reproduction | OPEN | Rebuild from migrations + seed in an empty disposable environment and compare schema/security invariants. |

**M0 status: IN PROGRESS** until the last two verification rows and final residue scan are green.

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

**Status: OPEN**

Verify in Stripe test mode, then controlled production readiness:
- authenticated checkout;
- server-side price recalculation;
- idempotent payment-intent creation;
- successful webhook signature validation;
- duplicate/replayed webhook behavior;
- failed/cancelled payment cleanup;
- inventory reservation/release;
- order creation across seller boundaries;
- fulfillment transition authorization;
- refund/partial-refund behavior if exposed at launch;
- auditability/reconciliation.

No real card processing until this gate is signed off.

## P0-04 — Authorization/RLS regression suite

**Status: OPEN**

Automated tests must prove representative anon/buyer/seller/cross-account/admin/service-role boundaries for catalog, profiles, products, orders, payment sessions, inventory, messages, KYC, uploads, and privileged RPCs. Manual inspection alone is not enough for launch.

## P0-05 — Seller/admin/KYC/storage security completion

**Status: OPEN**

Verify all seller/admin/KYC/upload routes against server-side ownership and least privilege. Define accepted upload types, size limits, path ownership, signed/public media boundaries, malware/content handling where applicable, and deletion/recovery behavior.

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
