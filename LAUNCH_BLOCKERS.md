# EntizNetStore — Canonical Launch Blockers

Last reviewed: **2026-08-24**

This is the canonical launch-readiness record. UI completeness does not clear a blocker. A blocker moves to `VERIFIED` only after production-safe authorization, failure handling and reproducible evidence are recorded.

## Status language

- **P0** — blocks real customer/payment data or public commerce launch.
- **P1** — blocks polished public V1/mobile parity.
- **P2** — post-launch improvement/scale work.
- Statuses: `OPEN`, `IN PROGRESS`, `VERIFIED`, `DEFERRED`.

---

# Milestone exit gates

## M0 — Database, repository and security control

**Status: VERIFIED**

Verified foundation includes canonical Supabase architecture, reproducible fresh-environment migrations/seed, RLS/security-definer review, removal of runtime Neon/Helium/Replit dependencies, production-oriented documentation, dependency/build verification and a recovery runbook.

Known release-engineering fact: Supabase management-applied migration versions can differ from repository filename timestamps. Applied migrations are immutable; the final release procedure must reconcile by name/content and never rewrite historical SQL. P0-06 owns the remaining migration-release procedure.

## M1 — Identity, Seller, KYC & Storage

**Status: VERIFIED**

A new standalone account can establish Buyer/Seller or Buyer/Seller/Business capabilities on one UUID, complete canonical Supabase-backed verification/storage flows and use trusted messaging without Replit infrastructure. KYC/private media boundaries, Seller/Business lifecycle, BSM synchronization, server-side validation and Admin audit workflows are covered by CI and live-database evidence.

## M2 — Catalogue & Seller Operations

**Status: VERIFIED — ENGINEERING/LIVE DATABASE/MAIN MERGE**

Verified catalogue lifecycle includes stable storefront slugs, trusted storefront settings, rich products/variants/inventory, RPC-only catalogue mutation, independent moderation, approval invalidation on edit, publication/policy/inventory invariants and canonical public storefront/product reads.

Historical M2 Vercel Hobby build-rate limiting remains evidence for P0-06; later production deployments supersede the old M2 preview as current runtime evidence.

## M3 — Marketplace Operations, Admin & EntizNet Integration

**Status: VERIFIED WITH PRE-LAUNCH INTEGRATION CONDITION**

Verified:

- persistent Buyer cart/address/quote/checkout core;
- legacy arbitrary checkout lockout;
- Buyer/Seller/Business suspension and linked EntizNet authority;
- Admin account/order/KYC/catalogue/refund/dispute/financial/trust/content operations;
- 45 public tables / 45 RLS / zero RLS-disabled production baseline;
- fourteen original M3 forward migrations and advisor hardening;
- exact M3 release CI and production deployment;
- post-M3 EntizNet Admin boundary hardening;
- direct EntizNet access to EntizNetStore Supabase privileged credentials removed and CI-prohibited;
- Store PR #10 exact head `848f23efb181be84a65fc19b079d7fd12ec24286` passed CI #339 / run `32710050313`;
- Store Admin-boundary migration live as `20260824131414_entiznet_admin_service_boundary` while repository filename is `20260824171000_entiznet_admin_service_boundary.sql`;
- private `app_private.entiznet_admin_api_requests` replay/audit ledger, no new public table;
- Store merge `e216ba9918dd2a50659aab595477fc39cef494fb` deployed READY as `dpl_8jAjnm8PNTQudvxQfSmmAFPM3ACa`;
- Store canonical root HTTP 200; unsigned Admin integration routes fail closed with HTTP 401; no runtime-error group during verification;
- EntizNet PR #30 exact head `98a1294dd3e99c01eea875f3a13610194e05cf62` passed CI #125 / run `32710100051`, including the direct-Store-database-credential rejection gate;
- EntizNet merge `29c505cd0bb1be56a912e0a2228a96a1bf3d8743` deployed READY as `dpl_GU5PWyAtgMQ72kubt8JbuA18Gkhc`;
- unauthenticated EntizNet Store Admin routes fail closed with HTTP 401 and no runtime-error group during verification.

Remaining integration condition is tracked under **P0-08**: production Ed25519 signing configuration plus real authenticated cross-product user/Admin E2E.

Architecture/evidence: `docs/architecture/M3-MARKETPLACE-OPERATIONS-ENTIZNET-INTEGRATION.md`, `docs/operations/M3_RELEASE_VERIFICATION.md`.

---

# P0 — blocks public commerce launch

## P0-01 — Durable production backups and tested restore

**Status: OPEN**

Current recovery documentation and pre-change checkpoints are not equivalent to durable managed/off-platform production backup.

Before real customer/KYC/order/payment/Seller data:

- automated encrypted off-platform logical backup and/or suitable managed Supabase backup/PITR;
- defined retention/access ownership;
- recorded restore rehearsal;
- documented RPO/RTO expectations.

## P0-02 — Production secret provisioning and rotation ownership

**Status: IN PROGRESS**

Server-only Supabase configuration and provider-neutral secret contracts exist. Real payment/payout credentials remain intentionally unprovisioned until approved providers/legal-entity relationships are selected.

Still required:

- provision EntizNet↔Store Ed25519 production integration configuration;
- finalize owner/rotation procedure for every remaining production secret;
- verify environment separation and no privileged value in Git/browser/mobile bundles.

## P0-03 — Production payment processor E2E

**Status: IN PROGRESS — EXTERNAL PROCESSOR ONBOARDING DEFERRED UNTIL PRE-LAUNCH**

Internal provider-neutral payment state machines, inventory reservation, checkout idempotency, webhook event deduplication/terminal-state rules and fail-closed `unconfigured` behavior are verified.

Still required before real checkout:

- select approved processor/legal entity;
- implement provider adapter without rewriting marketplace commerce state;
- deployed sandbox payment initialization;
- signed callback/webhook retries, duplicates and out-of-order verification;
- refund/partial-refund verification where launch scope requires it;
- reconciliation/incident procedure.

## P0-04 — Authorization/RLS HTTP regression coverage

**Status: IN PROGRESS**

Database-level cross-account, role/capability, Admin and trusted-worker isolation is extensive across M1–M3 and commerce/payment/payout suites.

Still required: representative deployed HTTP-level anon/Buyer/Seller/cross-account/Admin/integration ownership tests across catalogue, messaging, media/branding, storefront, Admin and integration routes.

## P0-05 — Seller/Admin/KYC/storage security completion

**Status: IN PROGRESS**

Verified controls include private KYC/message storage, size/magic-byte checks, Seller media ownership verification, RPC-only catalogue mutation, KYC/product moderation, trusted conversation-key access, reports/reviews/prohibited-product enforcement and narrow upload allow-lists.

Still required:

- remaining upload/ownership HTTP regressions;
- storage/database partial-failure recovery tests;
- malware/content scanning/moderation policy and implementation appropriate to launch risk;
- final public/private media boundary review under production deployment conditions.

## P0-06 — Production deployment and migration hardening

**Status: IN PROGRESS**

Verified:

- dedicated Vercel project `entiznetstore` linked to `OKenechukwu/EntizNetStore`;
- canonical HTTPS production runtime has deployed M3 and post-M3 Admin-boundary releases successfully;
- exact source commit/deployment/runtime checks are now part of release verification;
- production build uses canonical npm lockfile and foundation guards;
- historical Vercel Hobby build-rate incident is documented rather than misclassified as a code failure.

Still required:

- reliable production deployment capacity/automation not dependent on a rate-limit window;
- canonical owned production domain + DNS/HTTPS validation;
- final production/preview/staging isolation review;
- final CSP/header review for selected payment/Supabase flows;
- no accidental public debug/test/maintenance route;
- structured error/logging review with secret redaction;
- documented rollback/health procedure;
- finalized migration deployment/reconciliation procedure for management timestamp drift.

## P0-07 — Observability and commerce incident response

**Status: OPEN**

Need actionable production monitoring/alerts for:

- elevated server/runtime errors;
- auth/Admin/integration failures;
- checkout/payment/refund inconsistencies;
- payout/escrow reconciliation failures;
- storage/upload failures;
- database health;
- EntizNet handoff/Admin-service failures.

Define alert ownership, severity, retention and first-response runbooks.

## P0-08 — EntizNet identity/capability integration contract

**Status: IN PROGRESS — CODE/DATABASE/PRODUCTION DEPLOYMENTS VERIFIED; SIGNING KEYS + REAL AUTHENTICATED E2E PENDING**

Verified:

- one-to-one Store↔EntizNet identity mapping and auditable revocation;
- only canonical Store capabilities (`entiznetstore_buyer`, `entiznetstore_seller`, `entiznetstore_business`);
- linked EntizNet capability snapshot is upstream grant authority while Store-local suspension remains an additional deny;
- standalone Store accounts remain supported;
- short-lived Ed25519 user handoff, issuer/audience/time checks, POST transport, safe relative return path and replay-resistant `jti` ledger;
- Store handoff/identity-control RPCs are trusted-server/service-role boundaries;
- legacy EntizNet Admin direct Store Supabase bridge removed;
- EntizNet no longer requires EntizNetStore's service-role credential or privileged Store DB client;
- CI rejects reintroduction of legacy Store database credential names in EntizNet application code;
- domain-separated Admin assertions require `purpose=admin-api`, dedicated audience and allow-listed scopes (`store.health`, `store.accounts.read`);
- Admin replay/audit state is private in `app_private.entiznet_admin_api_requests` with the real EntizNet actor UUID;
- Store receiver and EntizNet sender are merged and READY in production with fail-closed unauthenticated/unsigned smoke checks and no route runtime-error groups.

Exact production configuration contract:

EntizNet:
- `ENTIZNETSTORE_HANDOFF_PRIVATE_KEY`
- `ENTIZNETSTORE_HANDOFF_KEY_ID`
- `ENTIZNETSTORE_HANDOFF_ISSUER`
- `ENTIZNETSTORE_HANDOFF_AUDIENCE`
- `ENTIZNETSTORE_ADMIN_API_AUDIENCE`
- `ENTIZNETSTORE_ORIGIN`

EntizNetStore:
- `ENTIZNET_HANDOFF_PUBLIC_KEY`
- `ENTIZNET_HANDOFF_KEY_ID`
- `ENTIZNET_HANDOFF_ISSUER`
- `ENTIZNET_HANDOFF_AUDIENCE`
- `ENTIZNET_ADMIN_API_AUDIENCE`

Still required before EntizNet-linked public launch:

- provision/own/rotate the production Ed25519 key pair in server-side secret stores;
- real confirmed EntizNet user → Store handoff;
- same-account link/no duplicate identity;
- Buyer/Seller/Business consistency and Store-local suspension precedence;
- replay rejection and safe return path;
- logout, revocation and re-entry;
- real signed EntizNet Admin health/account calls;
- verify failures are observable without assertion/token leakage.

## P0-09 — Seller payout/disbursement E2E

**Status: IN PROGRESS — EXTERNAL PAYOUT PROVIDER ONBOARDING DEFERRED UNTIL PRE-LAUNCH**

Internal payout ledger, escrow claiming, idempotency, failure/cancellation release rules, terminal success semantics, event replay protection and real PostgreSQL concurrency regression are verified.

Still required before real disbursement:

- select approved payout provider/legal entity;
- real adapter/provider-side idempotency;
- approve production payout hold policy;
- Seller payout-account onboarding/validation;
- signed callback/duplicate/retry/out-of-order verification;
- sandbox payout E2E;
- reconciliation/support/money-movement incident procedure.

---

# P1 — polished V1/product parity

## P1-01 — Native iOS/Android marketplace client

**Status: OPEN**

React Native + TypeScript mobile is a first-class product, not a web wrapper. Required work includes mobile foundation, shared domain/API contracts, secure auth/session storage, appropriate Buyer/Seller commerce parity, push/deep-link strategy and App Store/Play readiness.

## P1-02 — Responsive/accessibility production pass

**Status: OPEN**

Verify core Buyer/Seller/Admin flows across target viewport sizes, keyboard/focus/error states, screen-reader semantics, contrast, loading/empty/error/recovery states and touch ergonomics.

## P1-03 — Marketplace policy/operational content

**Status: OPEN**

Finalize launch terms/privacy, returns/refunds, Seller policies, prohibited/restricted products, age requirements, support/escalation paths and jurisdiction-specific commerce disclosures.

---

# Verification discipline

A blocker moves to `VERIFIED` only when the repository records reproducible evidence such as tests, migrations, CI runs, deployment checks or operational verification. Chat history is not the system of record.

When a blocker changes, update this file in the same development change whenever practical.
