# EntizNetStore — Canonical Launch Blockers

Last reviewed: **2026-08-31**

This file is the production launch-readiness source of truth. A feature is not launch-cleared because its UI works; launch gates require authorization, failure handling, operational ownership and reproducible evidence.

Statuses: `OPEN`, `IN PROGRESS`, `VERIFIED`, `DEFERRED`.

---

# Milestone exit gates

## M0 — Database, repository and security control
**Status: VERIFIED**

Canonical Supabase architecture, forward migrations, fresh-environment reproduction, RLS/privileged-function review, removal of Neon/Helium/Replit runtime assumptions, deployment/recovery documentation and CI foundations are established.

## M1 — Identity, Seller, KYC & Storage
**Status: VERIFIED**

Standalone and multi-capability Buyer/Seller/Business identities, Seller/BSM onboarding, KYC/private media, Seller media, messaging storage and Admin verification/audit authority are implemented on Supabase.

## M2 — Catalogue & Seller Operations
**Status: VERIFIED**

Seller-owned catalogue mutation, variants, inventory, storefronts, moderation, publication invalidation, search/read paths and catalogue policy invariants are verified.

## M3 — Marketplace Operations, Admin & EntizNet integration foundation
**Status: VERIFIED WITH EXTERNAL LAUNCH CONDITIONS**

Canonical server cart/quote/checkout/order/inventory authority, Admin operations, provider-neutral payment/payout ledgers, EntizNet signed integration contracts, observability foundations and production release controls are implemented. External provider/signing activation remains in P0-02/03/07/08/09.

## M4A — BSM Wholesale Marketplace
**Status: VERIFIED / PRODUCTION**

PR #36 built the BSM wholesale authority without creating a parallel commerce stack: verified Business roles, wholesale offers, MOQ + relative multiples, tiered pricing, case/unit semantics, inventory, B2B search/storefront flows, canonical wholesale cart/checkout/orders, Supplier/Business operations, Admin/security boundaries and hosted RLS/RPC verification.

Production evidence:

- release head `4f74feaa67fd215e9cab4a21d7bc6b7addc2fc57`;
- merge/source `6f33095dd6f015af9126684f541314e3842dfd6c`;
- Vercel production `dpl_BJCqdrvzu5fLfzS26gQUF2FJ5pCP` READY;
- `/api/health` HTTP 200 with DB/Storage/operations `ok` and version `6f33095dd6f0`;
- no production runtime errors in the post-release verification window;
- four forward M4A migrations present in production.

Detailed record: `docs/operations/M4A_PRODUCTION_EVIDENCE_2026-08-31.md`.

---

# P0 — blocks public commerce launch

## P0-01 — Durable production backups and tested restore
**Status: IN PROGRESS — ENGINEERING AUTOMATION BUILT; OPERATIONAL ACTIVATION + REHEARSAL PENDING**

Implemented by PR #37:

- encrypted logical backup design using the supported Supabase CLI roles/schema/data split;
- explicit `supabase_migrations` history backup;
- separate Supabase Storage object-byte export with per-object SHA-256;
- production-project source hard binding;
- `age` encryption before off-platform transfer;
- generic private S3-compatible durable destination with remote checksum metadata readback;
- no plaintext dump commits and no customer backup retained as GitHub Actions artifact;
- destructive restore workflow hard-refuses production and requires target-ref confirmation;
- restore checksum verification, Storage restore and DB/RLS/SECURITY DEFINER/M4A structural checks.

PR #37 is merged to production `main` at `79d767c21e95f89433d6e46d1264c7aba478c344`.

Still required to mark `VERIFIED`:

- provision the protected `production-backup` and `recovery-rehearsal` environment credentials/variables;
- complete one durable encrypted off-platform backup;
- restore that exact artifact into a disposable non-production Supabase recovery target;
- record measured RPO/RTO and verification evidence;
- then enable the recurring schedule and failed/missed-backup alerting.

Runbook: `docs/operations/BACKUP_RECOVERY.md`.

## P0-02 — Production secrets and rotation ownership
**Status: IN PROGRESS**

Verified: server-only Supabase boundaries, provider-neutral configuration contracts, environment separation controls and browser-secret prohibitions.

Still required:

- production EntizNet↔Store Ed25519 keys/rotation ownership;
- backup/recovery credentials and age-key recovery ownership;
- selected payment/payout/scanner/log-provider production secrets;
- final production/preview/development target separation review;
- secret rotation/revocation procedure for every privileged integration.

## P0-03 — Production payment processor E2E
**Status: IN PROGRESS — INTERNAL COMMERCE AUTHORITY VERIFIED; EXTERNAL PROCESSOR PENDING**

Verified: canonical trusted pricing/quote/checkout, inventory reservation, payment state machine, provider-neutral idempotency, webhook dedup/terminal rules and fail-closed `unconfigured` behavior.

Still required:

- select approved processor/legal entity;
- implement the production adapter against the existing state machine;
- deployed sandbox initialization;
- signed callback retry/duplicate/out-of-order tests;
- refund/partial-refund verification as launch scope requires;
- reconciliation and money-movement alerting.

## P0-04 — Authorization/RLS deployed regression
**Status: VERIFIED**

PR #35 closed the deployed authenticated gate after isolated hosted verification. Buyer, Seller, Business/BSM and Admin protected routes were tested with disposable identities against isolated Supabase/Vercel, including age-gate completion, exact backend binding, cross-role denial, deterministic cleanup and zero production mutation. The gate remains mandatory after material auth/session/RLS changes.

## P0-05 — Seller/Admin/KYC/upload security
**Status: IN PROGRESS — APPLICATION TRUST BOUNDARY VERIFIED; REAL SCANNER + POLICY PENDING**

PR #30 moved supported user uploads behind quarantine -> validate -> scan -> promote, with magic-byte validation, SHA-256, private quarantine, service-only scan ledger, fail-closed production scanner contract, compensation cleanup and HTTP/database regressions.

PR #38 then hardened the external-scanner boundary and is merged to production `main` at `29770498815f174da54110f4064432e784a04097` after exact-head CI, fresh DB reproduction, authenticated HTTP/Chromium/WCAG and Vercel preview verification. The application now enforces exact HTTPS-origin pinning, SSRF/private-host/IP-literal refusal, bearer-token validation, outbound SHA-256 integrity, bounded payload/response sizes, strict JSON verdict parsing, redirect refusal, metadata minimization and fail-closed transport/provider behavior. `/api/health` exposes only `launchGates.uploadSafety=configured|blocked` without scanner secrets or endpoint details.

Still required:

- provision an approved authenticated HTTPS malware/content scanner;
- configure the exact production scanner origin allowlist and dedicated bearer credential;
- verify live deployed clean, blocked/EICAR, provider-error and timeout behavior through the quarantine flow;
- finalize launch content/moderation policy and escalation for accepted upload classes.

Production must remain fail-closed while the scanner is unconfigured or unhealthy.

## P0-06 — Production domain, capacity and final release hardening
**Status: IN PROGRESS — PRO RELEASE + EXACT-SHA/CAPACITY ENGINEERING BUILT; OWNED DOMAIN/REHEARSALS/REPO PROTECTION PENDING**

Verified/implemented:

- Vercel project `entiznetstore` linked to the canonical GitHub repo;
- Vercel team is on Pro;
- exact-SHA deployment verification, DB/Storage/operations health and production runtime-log checks;
- production smoke can fail on deployed-version drift rather than accepting a healthy stale release;
- scheduled production monitor binds health to the exact `main` SHA and retries through a short deployment-convergence window;
- manual-only bounded production read-capacity gate hard-bound to `main`, the canonical production origin and exact deployed SHA;
- capacity probe is limited to `GET /` + `GET /api/health`, max concurrency 25 and max 500 total requests;
- Node 22/npm lockfile/runtime controls;
- noindex remains default until public-launch switch;
- M4A and subsequent release-hardening production deployments healthy.

Still required:

- enable GitHub `main` branch protection/ruleset so routine direct pushes, force pushes and branch deletion cannot bypass the PR/status-check release path;
- canonical owned launch domain + DNS/HTTPS;
- execute and record the bounded capacity rehearsal at the approved launch envelope;
- final environment-secret isolation/CSP review after external providers are selected;
- final rollback/release rehearsal on the owned domain;
- set `SITE_INDEXING_ENABLED=true` only at intentional public launch.

Runbooks: `docs/operations/PRODUCTION_RELEASE.md` and `docs/operations/PRODUCTION_CAPACITY.md`.

## P0-07 — Observability and commerce incident response
**Status: IN PROGRESS — CORE MONITORING + RELEASE-DRIFT DETECTION VERIFIED; EXTERNAL ALERT OWNERSHIP PENDING**

Verified: DB/Storage/operations health, bounded redacted operational events, 30-day private event ledger, 15-minute production monitor, exact-main deployment-drift detection, convergence retries, GitHub incident automation, incident runbook and production runtime error inspection.

Still required:

- external alert/log-drain/SIEM destination and ownership;
- final escalation/on-call path;
- payment/refund/payout reconciliation alerts after provider selection;
- EntizNet signing/integration failure alerts after production signing;
- recorded incident + recovery rehearsal on final launch configuration.

## P0-08 — EntizNet identity/capability production integration
**Status: IN PROGRESS — CONTRACT VERIFIED; PRODUCTION SIGNING/E2E PENDING**

Verified: one-to-one linked identity, Store capabilities, Store-local suspension precedence, standalone accounts, short-lived Ed25519 handoff, replay ledger, safe relative return path, dedicated signed Admin contract and removal of direct EntizNet Store service-role access.

Still required:

- provision and rotate production Ed25519 signing configuration;
- real EntizNet user -> Store handoff and same-account/no-duplicate proof;
- Buyer/Seller/Business consistency and revocation/logout/re-entry;
- replay rejection under real signing;
- real signed Admin health/account calls;
- production observability without assertion/token leakage.

## P0-09 — Seller payout/disbursement E2E
**Status: IN PROGRESS — INTERNAL LEDGER/CONCURRENCY VERIFIED; EXTERNAL PROVIDER PENDING**

Still required: payout provider/legal entity selection, Seller payout-account onboarding, provider-side idempotency, sandbox payout, signed callbacks, duplicates/retries/out-of-order behavior, reconciliation and incident/support procedure.

## P0-10 — Responsive web and accessibility launch gate
**Status: VERIFIED AS A REUSABLE RELEASE GATE; FINAL OWNED-DOMAIN CHECK COUPLED TO P0-06**

PR #29 established authenticated WCAG A/AA browser regression. PR #32 expanded real Buyer/Seller/Business/Admin responsive journeys, critical form validation/focus behavior, mobile-keyboard visibility, keyboard address suggestions, touch targets and zero-suppression axe coverage. PR #35 proved protected deployed flows in an isolated production-like environment. Any material UI/auth change must keep this gate green. The final owned-domain pass is tracked under P0-06 rather than reopening the engineering gate.

---

# P1 — post-web V1

## P1-01 — Native iOS/Android marketplace client
**Status: DEFERRED UNTIL AFTER PUBLIC WEB V1**

React Native + TypeScript remains first-class and must not be a WebView wrapper. Expo is preferred unless later repository/platform inspection proves a better production choice.

## P1-02 — Native store-review/mobile parity hardening
**Status: OPEN AFTER NATIVE FOUNDATION**

Includes signing, privacy declarations, permissions, universal/app links, push, screenshots/metadata, accessibility and then-current Apple/Google policy review.

## P1-03 — Marketplace legal/policy/operational content
**Status: OPEN**

Finalize launch terms/privacy, returns/refunds, Seller policies, prohibited/restricted products, age requirements, support/escalation paths and jurisdiction-specific disclosures.

---

# Fastest path to public web V1

1. **P0-01:** activate the encrypted DB + Storage backup path and complete one isolated restore rehearsal.
2. **P0-05:** provision the real upload scanner and finish content/moderation policy.
3. **P0-03 + P0-09:** select payment/payout providers and complete real sandbox E2E/reconciliation.
4. **P0-08:** provision EntizNet production Ed25519 signing and run real cross-product E2E.
5. **P0-07:** connect external logging/alerting and rehearse incident recovery.
6. **P0-06:** enable `main` protection, execute bounded capacity evidence, configure owned domain, perform final provider-aware CSP/env audit, rollback rehearsal and indexing switch.
7. **P0-02:** closes as the secret/rotation ownership gate across the integrations above.

P0-04 and P0-10 are now reusable regression gates, not unresolved feature defects. M4A is production-complete.

# Verification discipline

A blocker moves to `VERIFIED` only when the repository records evidence from tests, CI, migrations, deployments, live health/runtime checks or controlled operational rehearsals. Chat history is not the system of record.
