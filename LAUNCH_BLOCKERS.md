# EntizNetStore — Canonical Launch Blockers

Last reviewed: **2026-08-26**

This is the canonical launch-readiness record for EntizNetStore. UI completeness alone does not clear a blocker. A blocker moves to `VERIFIED` only after production-safe authorization, failure handling and reproducible evidence are recorded.

## Status language

- **P0** — blocks real customer/payment data or public commerce launch.
- **P1** — blocks polished product parity or the next planned release stage.
- **P2** — post-launch improvement/scale work.
- Statuses: `OPEN`, `IN PROGRESS`, `VERIFIED`, `DEFERRED`.

---

# Milestone exit gates

## M0 — Database, repository and security control

**Status: VERIFIED**

Verified foundation includes canonical Supabase architecture, reproducible fresh-environment migrations/seed, RLS and targeted `SECURITY DEFINER` review, removal of runtime Neon/Helium/Replit dependencies, production-oriented documentation, dependency/build verification and a recovery runbook.

Applied migrations remain immutable. `docs/operations/PRODUCTION_RELEASE.md` defines migration identity/content reconciliation and forward-only corrective migration procedure.

## M1 — Identity, Seller, KYC & Storage

**Status: VERIFIED**

A new standalone account can establish Buyer/Seller or Buyer/Seller/Business capabilities on one UUID, complete canonical Supabase-backed verification/storage flows and use trusted messaging without Replit infrastructure. KYC/private media boundaries, Seller/Business lifecycle, BSM synchronization, server-side upload validation and Admin audit workflows are covered by CI and live-database evidence.

## M2 — Catalogue & Seller Operations

**Status: VERIFIED — ENGINEERING/LIVE DATABASE/MAIN**

Verified catalogue lifecycle includes stable storefront slugs, trusted storefront settings, rich products/variants/inventory, RPC-only catalogue mutation, independent moderation, approval invalidation on edit, publication/policy/inventory invariants and canonical public storefront/product reads.

## M3 — Marketplace Operations, Admin & EntizNet Integration

**Status: VERIFIED WITH PRE-LAUNCH EXTERNAL-INTEGRATION CONDITIONS**

Verified engineering includes:

- persistent Buyer cart/address/quote/checkout core;
- canonical server-side price, availability, Seller split and inventory authority;
- legacy arbitrary checkout lockout;
- Buyer/Seller/Business multi-capability and suspension enforcement;
- Admin account/order/KYC/catalogue/refund/dispute/financial/trust/content operations;
- linked EntizNet capability authority with standalone Store accounts preserved;
- direct EntizNet access to EntizNetStore privileged Supabase credentials removed and CI-prohibited;
- short-lived signed EntizNet handoff/Admin contracts with replay/audit foundations;
- provider-neutral payment/payout state machines and concurrency protections;
- canonical production health, monitoring and operational event foundations.

### Latest web-commerce release evidence

PR #26 — web-first launch:

- exact head `b3313a0ffebf427ce4257c595a2df073dd8961fa`;
- CI run `32885369776` passed;
- HTTP Authorization Regression run `32885369783` passed, including real production-build Chromium phone/tablet/desktop verification;
- merged as `b4b6ecdd2a1659a99c710d7b6a4d50c58e9b2c65`;
- production deployment `dpl_GWFfNRz6Vm6nBwgn5tABSeuLQm5T` reached READY;
- canonical `/api/health` returned HTTP 200 with database/storage/operations all `ok` and exact version `b4b6ecdd2a16`;
- no error/fatal Vercel runtime logs were present in the release verification window.

PR #27 — canonical visible cart/checkout convergence:

- exact head `187693dbbbba8484347b8771edd571683cee4ba0` based on the merged PR #26 `main`;
- CI run `32886155564` passed the application, fresh-database, M1/M2/M3, commerce, payment, payout and concurrency suites;
- HTTP Authorization Regression run `32886155665` passed the real authenticated authorization and Chromium suite;
- exact-head Vercel preview `dpl_GcvW5QcVbEf4aJ7pYppNPxQBc8EJ` reached READY;
- merged as `919b163c11b4b3c2e6a8cc27b10c1e4604d563f8`;
- production deployment `dpl_CxYGsvVCcQxWrz76tghBhUsYVieg` reached READY;
- canonical `/api/health` returned HTTP 200 with database/storage/operations all `ok` and exact version `919b163c11b4`;
- no error/fatal Vercel runtime logs were present in the release verification window.

PR #27 additionally verifies that authenticated Buyers use the canonical server cart, guest carts import one-way after sign-in, checkout consumes trusted server quotes, payment initiation consumes one canonical checkout session, retries preserve quote-scoped idempotency, and billing-only/cross-Buyer addresses are rejected at the server quote boundary.

Remaining external/integration conditions are tracked under P0-02, P0-03, P0-06, P0-07, P0-08 and P0-09.

---

# P0 — blocks public commerce launch

## P0-01 — Durable production backups and tested restore

**Status: OPEN**

Current recovery documentation, migration reproducibility and pre-change checkpoints are not equivalent to durable managed/off-platform production backup.

Before real customer/KYC/order/payment/Seller data is accepted at public scale:

- establish automated encrypted off-platform logical database backup and/or suitable managed Supabase backup/PITR;
- separately protect required Supabase Storage objects because database backups do not constitute object backup;
- define retention, encryption and access ownership;
- record a restore rehearsal;
- document RPO/RTO expectations and recovery ownership.

This blocker must not be marked complete merely because migrations can recreate schema.

## P0-02 — Production secret provisioning and rotation ownership

**Status: IN PROGRESS**

Server-only Supabase configuration and provider-neutral secret contracts exist. Real payment/payout credentials remain intentionally unprovisioned until approved providers/legal-entity relationships are selected.

Still required:

- provision EntizNet↔Store production Ed25519 signing configuration;
- provision payment/payout/provider secrets only after provider selection;
- finalize owner/rotation procedure for every production secret;
- verify production/preview/development target separation;
- verify no privileged value appears in Git, browser bundles or future mobile bundles.

## P0-03 — Production payment processor E2E

**Status: IN PROGRESS — INTERNAL COMMERCE AUTHORITY VERIFIED; EXTERNAL PROCESSOR PENDING**

Verified:

- provider-neutral payment state machines;
- inventory reservation and checkout idempotency;
- webhook event deduplication and terminal-state rules;
- fail-closed `unconfigured` provider behavior;
- PR #27 visible checkout now uses the canonical server cart → trusted quote → canonical checkout-session → payment boundary chain;
- browser code does not provide authoritative prices, totals, Seller splits, shipping snapshots or payment amounts;
- retries for the same trusted quote reuse the same checkout session/idempotency attempt rather than manufacturing duplicate payment initialization.

Still required before real checkout:

- select approved processor/legal entity;
- implement the production provider adapter without replacing the canonical commerce state machine;
- deployed sandbox payment initialization;
- signed callback/webhook retry, duplicate and out-of-order verification;
- refund/partial-refund verification where launch scope requires it;
- provider reconciliation procedure;
- production money-movement alerting and incident integration.

## P0-04 — Authorization/RLS HTTP regression coverage

**Status: IN PROGRESS — BROAD REAL HTTP + FRESH-DB MATRIX VERIFIED**

Verified:

- database-level cross-account, role/capability, Admin and trusted-worker isolation across M1–M3 and commerce/payment/payout suites;
- PR #13 established production-built real HTTP authorization tests against freshly replayed Supabase with anonymous, Buyer, Seller/cross-account, Admin and unsigned EntizNet roles;
- PR #15 extended high-risk storage/media ownership coverage to Seller storefront/branding, KYC path ownership and cross-account product-media deletion;
- PR #25 froze the authenticated public `SECURITY DEFINER` surface behind a reviewed allow-list and CI guard;
- PR #26 runs the real HTTP matrix plus Chromium responsive/browser checks against a production build;
- PR #27 adds authenticated checkout HTTP coverage for anonymous quote denial, billing-only address rejection, cross-Buyer address rejection and owned shipping-address acceptance;
- PR #27 exact-head CI and HTTP runs passed after retargeting to the real post-PR #26 `main` base.

Still required before clearing P0-04:

- controlled authenticated verification of representative protected flows against a deployed production-like environment using disposable test identities, not only local-Supabase HTTP execution;
- repeat the matrix after any material auth/session/RLS architecture change;
- keep any future browser-callable privileged RPC addition behind the explicit review/CI allow-list.

## P0-05 — Seller/Admin/KYC/storage security completion

**Status: IN PROGRESS — STORAGE/MEDIA OWNERSHIP VERIFIED; MALWARE/CONTENT SCANNING PENDING**

Verified controls include:

- private KYC/message storage;
- size and magic-byte validation;
- Seller media and branding ownership verification;
- KYC path ownership;
- cross-account product-media delete denial;
- RPC-only catalogue mutation;
- KYC/product moderation and Admin audit flows;
- trusted conversation-key access;
- reports/reviews/prohibited-product enforcement;
- narrow upload allow-lists;
- compensation/recovery for important storage partial failures;
- required Storage bucket/public-private boundaries in canonical `/api/health`;
- bounded redacted operational logging for sensitive storage routes.

Still required:

- malware/content scanning or an explicitly approved equivalent upload-safety architecture appropriate to public-launch risk;
- final public content/moderation policy for accepted upload classes and escalation;
- re-verify public/private media boundaries after any storage-provider or upload architecture change.

## P0-06 — Production deployment, capacity, domain and migration hardening

**Status: IN PROGRESS — RELEASE/HEALTH/RUNTIME GUARDS VERIFIED; FINAL LAUNCH HOSTING CONDITIONS PENDING**

Verified:

- dedicated Vercel project `entiznetstore` linked to `OKenechukwu/EntizNetStore`;
- canonical HTTPS production runtime has repeatedly deployed M3 and subsequent P0/web-commerce hardening successfully;
- exact source commit/deployment/runtime checks are part of release verification;
- production build uses the canonical npm lockfile and effective Node 22 application engine contract;
- PR #12 established DB-backed `GET /api/health`, security headers, reproducible production smoke verification and release/rollback runbook;
- PR #16 added dynamic public-API route inventory guards, effective-runtime verification and verbose operational logging rejection;
- PR #18 added bounded structured error redaction for high-risk operational routes;
- PR #26 added `SITE_INDEXING_ENABLED`, defaulting false, and made CSP permit the exact configured Supabase HTTPS/WSS origin instead of broadening arbitrary HTTP access;
- PR #26 and PR #27 exact production releases both reached READY with healthy DB/Storage/operations and no error/fatal runtime logs during verification.

Capacity note:

- historical Vercel Hobby build-rate limiting was a real operational constraint;
- do **not** treat an unverified plan-tier assumption as closure of this blocker;
- confirm that the launch hosting tier/capacity, concurrency and deployment limits are appropriate before public traffic.

Still required:

- canonical owned production domain + DNS/HTTPS validation;
- launch-capacity/hosting-tier verification;
- final production/preview/development secret-target isolation review;
- final CSP review for the selected payment/payout/identity browser integrations;
- set and verify `SITE_INDEXING_ENABLED=true` only when public production is intentionally ready to be indexed;
- final release/rollback rehearsal on the owned launch domain after remaining P0 provider/configuration blockers are cleared.

## P0-07 — Observability and commerce incident response

**Status: IN PROGRESS — STORAGE READINESS + PRIVATE EVENT LEDGER + 15-MIN INCIDENT SIGNAL VERIFIED**

Verified/implemented foundations:

- canonical `/api/health` fails closed when database, required Storage boundaries or operational-event health are not `ok`;
- PR #17 added Storage bucket/public-private readiness to health and production smoke verification;
- PR #18 added bounded structured operational-event redaction that fingerprints identifiers and rejects raw stacks, tokens, signed URLs and arbitrary provider payloads;
- private `app_private.operational_events` persists only a safe allow-listed event subset;
- operational-event retention is 30 days;
- repeated error/critical events use a 5-events/15-minute degradation threshold;
- Production Monitor runs every 15 minutes and drives the canonical smoke signal;
- repository incident automation can create/update a GitHub production incident and record recovery;
- `docs/operations/INCIDENT_RESPONSE.md` defines severity, containment, recovery and evidence-handling rules;
- PR #26 and PR #27 release checks showed healthy DB/Storage/operations and no error/fatal Vercel runtime logs in their verification windows.

Still required before P0-07 is `VERIFIED`:

- external alert/log-drain/SIEM destination and retention/escalation ownership appropriate to public operations;
- processor-specific payment/refund inconsistency and callback reconciliation alerts once a real payment provider is selected;
- payout/escrow reconciliation alerts once the launch payout provider is selected;
- EntizNet handoff/Admin-service failure alerts after production signing is enabled;
- recorded production monitor incident/recovery execution evidence on the final launch configuration.

## P0-08 — EntizNet identity/capability integration contract

**Status: IN PROGRESS — CODE/DATABASE/DEPLOYMENTS VERIFIED; PRODUCTION SIGNING + REAL AUTHENTICATED E2E PENDING**

Verified:

- one-to-one Store↔EntizNet identity mapping and auditable revocation;
- canonical Store capabilities `entiznetstore_buyer`, `entiznetstore_seller`, `entiznetstore_business`;
- linked EntizNet capability snapshot as upstream grant authority while Store-local suspension remains an additional deny;
- standalone Store accounts remain supported;
- short-lived Ed25519 user handoff with issuer/audience/time checks, POST transport, safe relative return path and replay-resistant `jti` ledger;
- Store handoff/identity-control RPCs are trusted-server/service-role boundaries;
- legacy EntizNet Admin direct Store Supabase bridge removed;
- EntizNet no longer requires EntizNetStore service-role credentials;
- CI rejects reintroduction of legacy Store database credentials into EntizNet application code;
- domain-separated Admin assertions require dedicated purpose/audience/scopes;
- Admin replay/audit state is private in `app_private.entiznet_admin_api_requests`;
- unsigned/unauthenticated integration paths fail closed.

Production configuration contract:

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

- provision, own and rotate the production Ed25519 key pair in server-side secret stores;
- real confirmed EntizNet user → Store handoff;
- same-account link/no duplicate identity;
- Buyer/Seller/Business consistency and Store-local suspension precedence;
- replay rejection and safe return path under real signing configuration;
- logout, revocation and re-entry;
- real signed EntizNet Admin health/account calls;
- verify integration failures are observable without assertion/token leakage.

## P0-09 — Seller payout/disbursement E2E

**Status: IN PROGRESS — INTERNAL LEDGER/CONCURRENCY VERIFIED; EXTERNAL PAYOUT PROVIDER PENDING**

Verified:

- internal payout ledger;
- escrow claiming;
- idempotency;
- failure/cancellation release rules;
- terminal success semantics;
- event replay protection;
- real PostgreSQL concurrency regression;
- fail-closed payout/escrow containment principles in incident documentation.

Still required before real disbursement:

- select approved payout provider/legal entity;
- real adapter/provider-side idempotency;
- approve production payout hold policy;
- Seller payout-account onboarding/validation;
- signed callback/duplicate/retry/out-of-order verification;
- sandbox payout E2E;
- provider-specific reconciliation/support/money-movement incident procedure.

## P0-10 — Responsive web and accessibility public-launch pass

**Status: IN PROGRESS — CORE RESPONSIVE BROWSER REGRESSION VERIFIED**

EntizNetStore public V1 launches on the web before native apps. The web must therefore be a first-class phone/tablet/desktop product.

Verified by PR #26:

- production-built Chromium verification across phone, tablet and desktop viewport classes;
- horizontal-overflow regression checks;
- age-gate behavior;
- browser console/page-error rejection;
- shared `/apps` and Download App navigation behavior;
- compact-header/mobile navigation fixes;
- explicit 48px compact navigation/touch targets where failures were found;
- exact-head HTTP/Chromium run `32885369783` passed before merge;
- merged production release `b4b6ecdd2a1659a99c710d7b6a4d50c58e9b2c65` was healthy.

PR #27 additionally passed the same production-build HTTP/Chromium workflow after the canonical cart/checkout rewrite.

Still required before public web launch:

- broader Buyer, Seller, Business and Admin launch-scope responsive walkthroughs where current automated routes do not cover the complete workflow;
- keyboard navigation and focus-management pass across critical forms/dialogs;
- labels/semantics, contrast and screen-reader verification for critical paths;
- mobile-keyboard behavior on forms and checkout;
- loading, empty, validation, error, retry and recovery state review under constrained/mobile conditions;
- production-like accessibility/responsive regression on the final owned launch domain.

Architecture/sequence: `docs/architecture/WEB_FIRST_LAUNCH_AND_NATIVE_MOBILE.md`.

---

# P1 — post-web V1 / native product parity

## P1-01 — Native iOS/Android marketplace client

**Status: DEFERRED UNTIL AFTER PUBLIC WEB V1 — NOT A WEB-LAUNCH BLOCKER**

React Native + TypeScript mobile remains a first-class product, not a web wrapper. Public responsive web launches first. The web includes a stable Download App entry and `/apps` page; until legitimate store listings exist, iOS/Android states remain clearly marked coming soon.

After web launch gates are cleared, native work proceeds through shared domain/API contracts, secure device session storage, Buyer/Seller mobile flows, push notifications, deep links/EntizNet entry points and production mobile observability. Expo is preferred unless repository/platform inspection gives a strong reason otherwise.

Architecture/sequence: `docs/architecture/WEB_FIRST_LAUNCH_AND_NATIVE_MOBILE.md`.

## P1-02 — Native store-review and mobile parity hardening

**Status: OPEN — AFTER NATIVE FOUNDATION**

Before either native client is submitted, re-audit then-current Apple App Store and Google Play rules against the actual EntizNetStore catalogue/content, age gating, payments, privacy/account controls and Seller functionality. Acceptance is a release gate, not an assumption.

Required work includes separate iOS/Android signing and release configuration, privacy declarations, app permissions, universal/app links, notifications, screenshots/metadata, accessibility, production store-build verification and response to review findings. Official `/apps` store links are enabled only after legitimate listings exist.

## P1-03 — Marketplace policy/operational content

**Status: OPEN**

Finalize launch terms/privacy, returns/refunds, Seller policies, prohibited/restricted products, age requirements, support/escalation paths and jurisdiction-specific commerce disclosures.

---

# Current public-web launch focus

The highest-impact unresolved launch blockers are now:

1. **P0-01** — durable database + Storage backup and tested restore.
2. **P0-03** — real payment processor selection/integration/E2E.
3. **P0-05** — malware/content scanning or approved equivalent upload-safety architecture.
4. **P0-06** — owned launch domain, hosting capacity/tier confirmation, environment isolation and final release rehearsal.
5. **P0-07** — external alert/log destination and provider-specific reconciliation alerts.
6. **P0-08** — production EntizNet Ed25519 signing and real authenticated cross-product E2E.
7. **P0-09** — real payout provider E2E.
8. **P0-10** — broader accessibility and final launch-domain responsive verification.

P0-02 remains coupled to the external provider/signing selections above. P0-04 remains a continuing authorization verification gate rather than a known code defect.

---

# Verification discipline

A blocker moves to `VERIFIED` only when the repository records reproducible evidence such as tests, migrations, CI runs, deployment checks or operational verification. Chat history is not the system of record.

When a blocker changes, update this file in the same development change whenever practical.
