# EntizNetStore — Canonical Launch Blockers

Last reviewed: **2026-08-25**

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

Supabase management-applied migration versions can differ from repository filename timestamps. Applied migrations remain immutable. `docs/operations/PRODUCTION_RELEASE.md` now defines migration identity/content reconciliation and forward-only corrective migration procedure; P0-06 retains the broader production release/environment/deployment conditions.

## M1 — Identity, Seller, KYC & Storage

**Status: VERIFIED**

A new standalone account can establish Buyer/Seller or Buyer/Seller/Business capabilities on one UUID, complete canonical Supabase-backed verification/storage flows and use trusted messaging without Replit infrastructure. KYC/private media boundaries, Seller/Business lifecycle, BSM synchronization, server-side validation and Admin audit workflows are covered by CI and live-database evidence.

## M2 — Catalogue & Seller Operations

**Status: VERIFIED — ENGINEERING/LIVE DATABASE/MAIN MERGE**

Verified catalogue lifecycle includes stable storefront slugs, trusted storefront settings, rich products/variants/inventory, RPC-only catalogue mutation, independent moderation, approval invalidation on edit, publication/policy/inventory invariants and canonical public storefront/product reads.

Historical M2 Vercel Hobby build-rate limiting remains recorded as an incident, but the project now runs on Vercel Pro and current production deployments supersede the old Hobby-capacity evidence.

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
- provider reconciliation procedure and production money-movement incident integration.

## P0-04 — Authorization/RLS HTTP regression coverage

**Status: IN PROGRESS — BROAD REAL HTTP MATRIX + SECURITY-DEFINER SURFACE VERIFIED**

Verified:

- database-level cross-account, role/capability, Admin and trusted-worker isolation remains extensive across M1–M3 and commerce/payment/payout suites;
- PR #13 established production-built real HTTP authorization tests against a freshly replayed Supabase stack with anonymous, Buyer, Seller/cross-account, Admin and unsigned EntizNet roles;
- PR #15 extended high-risk storage/media ownership coverage to Seller storefront/branding, KYC path ownership and cross-account product-media deletion boundaries;
- PR #25 exact head `fe3b4a9c19bc194eb787e54668e562debd0f036f` passed CI run `32867931444` and HTTP Authorization Regression run `32867931437`;
- PR #25 freezes the authenticated public `SECURITY DEFINER` surface to an exact reviewed 21-function allow-list, requires every retained client privileged RPC to preserve `auth.uid()` scoping and requires the anonymous public privileged RPC surface to remain empty;
- live Supabase verification after PR #25 confirmed the retired Stripe compatibility wrapper is anonymous/authenticated denied and service-role only, while the canonical provider-neutral payment-reference RPC remains authenticated/self-scoped;
- PR #25 merged as `5db7250c05a8d08779f3af0d9524f24ebeddbc5b`; canonical production health returned HTTP 200 with database/storage/operations all `ok` and exact version `5db7250c05a8`.

Still required before clearing P0-04:

- controlled authenticated verification against a deployed production-like environment rather than only local-Supabase HTTP execution;
- repeat the representative matrix after any material auth/session/RLS architecture change;
- keep any future browser-callable privileged RPC addition behind the explicit CI review allow-list.

## P0-05 — Seller/Admin/KYC/storage security completion

**Status: IN PROGRESS — STORAGE/MEDIA OWNERSHIP VERIFIED; MALWARE/CONTENT SCANNING PENDING**

Verified controls include private KYC/message storage, size and magic-byte validation, Seller media ownership verification, RPC-only catalogue mutation, KYC/product moderation, trusted conversation-key access, reports/reviews/prohibited-product enforcement and narrow upload allow-lists.

Additional verified hardening:

- PR #11 verified storage compensation/recovery for KYC, messaging and Seller branding partial failures;
- PR #13 verified representative real HTTP KYC/product-media/message-attachment authorization and ownership behavior;
- PR #15 merged as `8bc9271c16aaa1ab6342521afe97f8692943270a` and added Seller storefront/branding, KYC path ownership, product-media cross-account delete denial and direct bucket-boundary regressions;
- KYC and message buckets remain private; product-media and Seller-branding buckets retain their intentional public/private boundaries with server-controlled upload/delete routes;
- PR #17 made Storage bucket/public-private readiness part of canonical `/api/health`;
- PR #18 redacts sensitive operational storage-route failures before logging/persistence.

Still required:

- malware/content scanning or an explicitly approved equivalent upload-safety architecture appropriate to public-launch risk;
- final production content/moderation policy for accepted upload classes and escalation;
- re-verify public/private media boundaries after any storage-provider or upload architecture change.

## P0-06 — Production deployment and migration hardening

**Status: IN PROGRESS — RELEASE/HEALTH/RUNTIME GUARDS + VERCEL PRO CAPACITY VERIFIED**

Verified:

- dedicated Vercel project `entiznetstore` linked to `OKenechukwu/EntizNetStore`;
- project is now on Vercel Pro; exact-head previews and production deployments no longer depend on the former Hobby build-rate window;
- canonical HTTPS production runtime has deployed M3 and subsequent P0 hardening successfully;
- exact source commit/deployment/runtime checks are part of release verification;
- production build uses the canonical npm lockfile, effective Node 22 engine contract and CI runtime guards;
- PR #12 established DB-backed `GET /api/health`, production security headers, reproducible production smoke verification and the release/rollback runbook;
- PR #16 added dynamic public-API route inventory guards, effective-runtime verification and verbose operational logging rejection;
- PR #18 added bounded structured error redaction for high-risk operational routes;
- PR #25 production deployment `dpl_94WD4YipkZuTxAAmJRQ8H5CqSHa2` reached READY on exact merge `5db7250c05a8d08779f3af0d9524f24ebeddbc5b` with no error/fatal runtime logs in the verification window;
- this web-first launch slice introduces `SITE_INDEXING_ENABLED`, defaulting to false so search indexing is an explicit production-launch action rather than an accidental development setting.

Still required:

- canonical owned production domain + DNS/HTTPS validation;
- final production/preview/staging secret-target isolation review;
- final CSP review for the actually selected payment/payout/identity browser integrations;
- set and verify `SITE_INDEXING_ENABLED=true` only when public production is intentionally ready to be indexed;
- final release rehearsal on the owned launch domain after remaining P0 external-provider/configuration blockers are cleared.

## P0-07 — Observability and commerce incident response

**Status: IN PROGRESS — STORAGE READINESS + PRIVATE EVENT LEDGER + 15-MIN INCIDENT SIGNAL VERIFIED**

Verified/implemented foundations:

- canonical `/api/health` fails closed when database, required Storage boundaries or operational-event health are not `ok`;
- PR #17 added Storage bucket/public-private readiness to health and production smoke verification;
- PR #18 added bounded structured operational-event redaction that fingerprints actor/record identifiers and rejects raw stacks, tokens, signed URLs and arbitrary provider payloads;
- the private `app_private.operational_events` ledger persists only a safe allow-listed event subset, retains events for 30 days and exposes service-role-only aggregate health;
- repeated error/critical events use a 5-events/15-minute degradation threshold and the production monitor runs every 15 minutes;
- repository incident automation creates/updates a GitHub production incident on failed canonical smoke and records/closes recovery after health returns;
- `docs/operations/INCIDENT_RESPONSE.md` defines severity, containment, recovery and evidence-handling rules;
- PR #25 production verification again showed database/storage/operations healthy and no error/fatal Vercel runtime logs in the reviewed window.

Still required before P0-07 is `VERIFIED`:

- external alert/log-drain/SIEM destination and retention/escalation ownership appropriate to public operations;
- processor-specific payment/refund inconsistency and callback reconciliation alerts once a real payment provider is selected;
- payout/escrow reconciliation alerts once the launch payout provider is selected;
- EntizNet handoff/Admin-service failure alerts after production signing configuration is enabled;
- recorded production monitor incident/recovery execution evidence on the final launch configuration.

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

Internal payout ledger, escrow claiming, idempotency, failure/cancellation release rules, terminal success semantics, event replay protection and real PostgreSQL concurrency regression are verified. The incident-response runbook now defines fail-closed payout/escrow containment and reconciliation principles.

Still required before real disbursement:

- select approved payout provider/legal entity;
- real adapter/provider-side idempotency;
- approve production payout hold policy;
- Seller payout-account onboarding/validation;
- signed callback/duplicate/retry/out-of-order verification;
- sandbox payout E2E;
- provider-specific reconciliation/support/money-movement incident procedure.

## P0-10 — Responsive web and accessibility public-launch pass

**Status: OPEN — WEB PUBLIC-LAUNCH BLOCKER**

EntizNetStore public V1 launches on the web before the native apps. The web therefore must be a first-class phone/tablet/desktop product, not merely a desktop precursor to mobile.

Required before public web launch:

- verify core Buyer, Seller, Business and Admin launch-scope flows across target phone, tablet and desktop viewports;
- verify keyboard navigation, focus management, labels/semantics, contrast and screen-reader behavior for critical paths;
- verify touch ergonomics, sticky/fixed controls and mobile keyboard behavior on forms and checkout;
- verify loading, empty, validation, error, retry and recovery states on constrained/mobile connections;
- verify the shared `Download App` navigation entry and `/apps` availability page across responsive breakpoints;
- complete a production-like accessibility/responsive regression pass on the launch domain.

Architecture/sequence: `docs/architecture/WEB_FIRST_LAUNCH_AND_NATIVE_MOBILE.md`.

---

# P1 — polished V1/product parity

## P1-01 — Native iOS/Android marketplace client

**Status: DEFERRED UNTIL AFTER PUBLIC WEB V1 — NOT A WEB-LAUNCH BLOCKER**

React Native + TypeScript mobile remains a first-class product, not a web wrapper. Public responsive web launches first. The web includes a stable `Download App` entry and `/apps` page; until legitimate store listings exist, iOS/Android states remain clearly marked coming soon.

After the web launch gates are cleared, native work proceeds through shared domain/API contracts, secure device session storage, Buyer/Seller mobile flows, push notifications, deep links/EntizNet entry points and production mobile observability. Expo is preferred unless repository/platform inspection gives a strong reason otherwise.

Architecture/sequence: `docs/architecture/WEB_FIRST_LAUNCH_AND_NATIVE_MOBILE.md`.

## P1-02 — Native store-review and mobile parity hardening

**Status: OPEN — AFTER NATIVE FOUNDATION**

Before either native client is submitted, re-audit the then-current Apple App Store and Google Play rules against the actual EntizNetStore catalogue/content, age gating, payments, privacy/account controls and Seller functionality. Acceptance is a release gate, not an assumption.

Required work includes separate iOS/Android signing and release configuration, privacy declarations, app permissions, universal/app links, notifications, screenshots/metadata, accessibility, production store-build verification and response to review findings. Official `/apps` store links are enabled only after legitimate listings exist.

## P1-03 — Marketplace policy/operational content

**Status: OPEN**

Finalize launch terms/privacy, returns/refunds, Seller policies, prohibited/restricted products, age requirements, support/escalation paths and jurisdiction-specific commerce disclosures.

---

# Verification discipline

A blocker moves to `VERIFIED` only when the repository records reproducible evidence such as tests, migrations, CI runs, deployment checks or operational verification. Chat history is not the system of record.

When a blocker changes, update this file in the same development change whenever practical.
