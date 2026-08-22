# EntizNetStore — Canonical Launch Blockers

Last reviewed: **2026-08-22**

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
| Environment/secrets contract | VERIFIED | `.env.example` + `docs/operations/ENVIRONMENT_SECRETS.md`; payment-provider configuration is provider-neutral and fail-closed when unconfigured. |
| Database security-advisor cleanup | VERIFIED WITH DOCUMENTED EXCEPTIONS | Remaining advisor entries are intentional deny-by-default tables and audited authenticated `SECURITY DEFINER` RPCs. |
| RLS audit | VERIFIED | All 27 exposed public tables have RLS enabled; intentional no-policy tables deny by default. |
| `SECURITY DEFINER` audit | VERIFIED | RPC execute grants and search paths explicitly controlled; payment finalization remains service-role-only. |
| Performance indexes/policy optimization | VERIFIED | Missing FK indexes, auth-init-plan and overlapping permissive-policy warnings removed. |
| Capability architecture decision | VERIFIED | `docs/architecture/ADR-0001-account-capabilities.md`. |
| Backup/recovery procedure | VERIFIED | Operational runbook committed; managed backup requirement remains a separate P0 before customer/payment data. |
| Canonical launch blocker record | VERIFIED | This document. |
| Broken/legacy translation surfaces | VERIFIED | Orphaned dynamic cache endpoints, anonymous DeepL proxy, and client translation callers removed; static localization remains. |
| Clean dependency/install/build verification | VERIFIED | Locked install, production-foundation scan, TypeScript, production build, dependency audit and fresh database reproduction are enforced by CI. |
| Fresh database reproduction | VERIFIED | CI starts a fresh PostgreSQL 17/Supabase stack, rebuilds from all migrations + seed, verifies schema/RLS/RPC/index/storage invariants, runs commerce regressions, and shuts down cleanly. |

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

The provider-neutral secret contract is documented and the dedicated EntizNetStore Vercel project is established. Supabase production configuration is provisioned without exposing privileged values to browser/mobile code. Real payment-provider merchant/webhook/payout credentials are intentionally not provisioned until an approved processor and contracting legal entity are selected.

Before launch, all remaining production credentials must be stored in the deployment secret store, privilege-scoped, environment-isolated, and assigned an owner/rotation procedure. No production secret may live in Git or a browser/mobile bundle.

## P0-03 — Production payment processor end-to-end verification

**Status: IN PROGRESS — external processor onboarding deferred until pre-launch**

Verified internal commerce/payment layer:
- checkout and payment processing are now separated by the provider boundary in `docs/architecture/ADR-0002-payment-provider-boundary.md`;
- the marketplace owns server-side price calculation, checkout idempotency, inventory reservation/consumption/release, seller order splitting, payment-session state, escrow and fulfillment state;
- canonical `payment_provider` / `provider_payment_id` references replace processor-specific identity in new application code;
- provider callbacks normalize to `succeeded`, `retryable_failure`, `terminal_failure`, or `cancelled` before touching commerce state;
- exact event replay is deduplicated and provider IDs namespace event identities;
- paid sessions cannot be downgraded by late failures;
- failed/cancelled sessions cannot be reopened by later retryable/terminal callbacks, while a late success against released inventory is rejected as a reconciliation incident;
- legacy Stripe RPC signatures remain compatibility wrappers only and preserve strict Stripe event/outcome validation;
- the public application has a safe `unconfigured` payment state: no external charge is attempted and no fake-payment production route exists;
- CI run #88 rebuilt PostgreSQL 17/Supabase and passed the original P0 commerce/security suite plus the provider-neutral payment simulator suite; subsequent terminal-state regression coverage is enforced by the same CI workflow;
- Vercel preview builds of the provider-neutral application are successful.

Still required before real payment processing/public launch:
- select a processor that accepts the final marketplace business model and contracting legal entity;
- implement that provider through the adapter contract rather than rewriting checkout/order logic;
- complete provider sandbox/test payment initialization through the deployed application;
- verify actual signed webhook/callback deliveries, retries, duplicates and out-of-order events at the HTTP boundary;
- define and test refunds/partial refunds where exposed at launch;
- implement provider reconciliation and operational incident procedures;
- connect provider payout/disbursement behavior only after seller payout controls are independently hardened and verified.

The missing external processor does **not** block continued engineering or internal commerce-state verification. It remains a hard gate before accepting real payment data or enabling public checkout.

## P0-04 — Authorization/RLS regression suite

**Status: IN PROGRESS**

Automated buyer/seller/cross-account/service-role coverage exists for orders, order items, payment sessions, inventory reservations, escrow, checkout RPCs and fulfillment transitions. Live verification confirms all 27 public tables remain RLS-enabled, authenticated transaction readers have SELECT-only table privileges, raw webhook records remain API-inaccessible, payment finalization remains service-role-only, and the service role has an explicit trusted-worker DML contract across the canonical schema.

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

**Status: IN PROGRESS**

Verified:
- EntizNetStore now has a dedicated Vercel project (`entiznetstore`) linked only to `OKenechukwu/EntizNetStore`;
- the incorrectly linked EntizNet Vercel projects were disconnected and no longer consume EntizNetStore builds;
- the canonical Vercel HTTPS alias serves the production deployment successfully;
- production build uses the canonical npm lockfile and stale Replit/Yarn/pnpm deployment artifacts are blocked by the foundation guard;
- the deployed home page returns HTTP 200 with security headers and Vercel reported no runtime-error clusters during initial verification.

Still required before public launch:
- canonical owned production domain and DNS/HTTPS validation;
- final production/preview/staging environment isolation review;
- final CSP/header review for the selected payment provider and Supabase flows;
- confirm no debug/test/admin maintenance route is accidentally public;
- structured error/logging review without secret leakage;
- documented deployment rollback/health procedure;
- finalized database migration deployment procedure and production release checklist.

## P0-07 — Observability and commerce incident response

**Status: OPEN**

Production needs actionable monitoring for payment callback failures, checkout/order inconsistencies, elevated server errors, auth/admin failures, storage failures, and database health. Define alert ownership and the first incident-response runbook.

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
