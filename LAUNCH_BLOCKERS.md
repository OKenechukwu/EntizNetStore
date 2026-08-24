# EntizNetStore — Canonical Launch Blockers

Last reviewed: **2026-08-24**

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
| Reconcile repository/live migration history | VERIFIED WITH KNOWN VERSION DRIFT | Repository migration content and live schema history are reconciled and applied SQL is never rewritten. Supabase management-applied M1–M3 migrations can receive live version timestamps different from repository filenames; the release procedure must map names/content rather than pretending the timestamps are identical. Final migration-deployment procedure remains under P0-06. |
| Pre-change production recovery checkpoint | VERIFIED | Current application data captured in `supabase/seed.sql`; recovery runbook in `docs/operations/BACKUP_RECOVERY.md`. |
| Remove runtime Neon/Helium assumptions | VERIFIED | `npm run verify:foundation` scans executable runtime source and passed in CI; historical provenance inside already-applied migrations remains immutable. |
| Remove Replit runtime/debug assumptions | VERIFIED | `.replit`, Replit sidecar storage, and routable debug/dev/test surfaces removed; runtime client no longer depends on Replit preview behavior. |
| Remove unused legacy dependencies | VERIFIED | `package.json`/`package-lock.json` synchronized; clean locked `npm ci` and production dependency audit pass in CI. |
| Replace template README | VERIFIED | Production-oriented EntizNetStore README committed. |
| Environment/secrets contract | VERIFIED | `.env.example` + `docs/operations/ENVIRONMENT_SECRETS.md`; buyer-payment and seller-payout configuration are provider-neutral and fail closed when unconfigured. |
| Database security-advisor cleanup | VERIFIED WITH DOCUMENTED EXCEPTIONS | Remaining advisor entries are intentional deny-by-default tables and audited authenticated `SECURITY DEFINER` RPCs. |
| RLS audit | VERIFIED | M0 established RLS on every then-current public table; later milestones extend the baseline and verify their own additions. |
| `SECURITY DEFINER` audit | VERIFIED | RPC execute grants and search paths explicitly controlled; payment/payout finalization and M1 admin KYC decisions remain restricted to their intended principals. |
| Performance indexes/policy optimization | VERIFIED | Missing FK indexes, auth-init-plan and overlapping permissive-policy warnings removed. |
| Capability architecture decision | VERIFIED | `docs/architecture/ADR-0001-account-capabilities.md`. |
| Backup/recovery procedure | VERIFIED | Operational runbook committed; managed backup requirement remains a separate P0 before customer/payment data. |
| Canonical launch blocker record | VERIFIED | This document. |
| Broken/legacy translation surfaces | VERIFIED | Orphaned dynamic cache endpoints, anonymous DeepL proxy, and client translation callers removed; static localization remains. |
| Clean dependency/install/build verification | VERIFIED | Locked install, production-foundation scan, TypeScript, production build, dependency audit and fresh database reproduction are enforced by CI. |
| Fresh database reproduction | VERIFIED | CI starts a fresh PostgreSQL 17/Supabase stack, rebuilds from all migrations + seed, verifies schema/RLS/RPC/index/storage invariants, runs milestone plus commerce/payment/payout regressions, and shuts down cleanly. |

**M0 status: VERIFIED.** The production-foundation exit gate is complete. M0 verification does **not** clear the independent P0 launch blockers below.

---

## M1 — Identity, Seller, KYC & Storage exit gate

**Exit gate:** a brand-new user can become a Seller without any Replit infrastructure.

| Item | Status | Evidence |
| --- | --- | --- |
| Canonical Buyer capability | VERIFIED | Buyer is the standalone marketplace baseline projection on `profiles_buyer`. |
| Canonical Seller capability | VERIFIED | Seller is additive to Buyer and remains server-derived from `profiles_seller`, never client role metadata. |
| Canonical Business/BSM capability | VERIFIED | `profiles_business` is the distinct Business projection; BSM onboarding provisions Buyer + Seller + Business on one UUID so BSM accounts can use canonical Seller commerce APIs. |
| Multi-capability support | VERIFIED | Fresh-database regression proves one identity can simultaneously hold Buyer + Seller + Business projections. |
| EntizNet account-model alignment | VERIFIED FOR M1 | ADR-0001 establishes one identity/multiple capabilities and a clean repository boundary. The actual cross-product EntizNet identity handoff remains tracked under P0-08. |
| Registration/onboarding | VERIFIED | Seller and BSM signup choices resume through trusted server onboarding. `/seller/apply` and `/bsm/apply` can add/repair capabilities later without a second account. |
| Seller/Business verification states | VERIFIED | Explicit pending → under_review → verified/rejected lifecycle with suspended reserved for operator restriction; BSM uses business-grade KYC. |
| Replit KYC/storage dependency removal | VERIFIED | Canonical Seller/BSM onboarding and KYC use Supabase Auth, Postgres and Storage only. |
| Supabase Storage buckets | VERIFIED | Live project and fresh CI contain `kyc-documents`, `product-media`, `seller-branding`, and `message-attachments` with required privacy/size/type contracts. |
| KYC private access | VERIFIED | Seller-own metadata reads only, private object bucket, short-lived server-authorized signed views, actual byte-size/magic-byte validation, no browser KYC mutation grants. |
| Product-media uploads | VERIFIED | Seller-scoped upload initialization plus server re-download/ownership/size/signature verification before product persistence. |
| Seller logo/banner uploads | VERIFIED | Server-validated 5MB JPEG/PNG/WebP storage path plus usable Seller branding dashboard and replacement cleanup. |
| Message attachment storage | VERIFIED | Private 15MB PDF/JPEG/PNG/WebP uploads, sender-only attachment creation, participant-only signed downloads, participant RLS metadata and integrated messaging UI. |
| Unsafe-file reduction | VERIFIED FOR M1 | Narrow allow-lists and magic-byte checks reject executables/scripts/archives/arbitrary binaries; dedicated antivirus/content scanning remains a launch-policy item under P0-05. |
| Trusted messaging boundary | VERIFIED | Conversation-key access, encryption/decryption, conversation listing and attachment metadata now stay behind authenticated server routes; `conversation_keys` remains browser-denied. |
| Admin KYC workflow | VERIFIED | Trusted admin route, batched Seller/Business review queue, service-role-only transactional document/final review functions. |
| Audit trails | VERIFIED | KYC decision and `admin_audit_logs` insertion occur in one database transaction; final BSM decision synchronizes Seller + Business state atomically. |
| Database/RLS baseline | VERIFIED | Live EntizNetStore reports 31 public tables, 31 with RLS, 9 intentional deny-by-default tables, and all four M1 buckets. |
| Fresh regression/build evidence | VERIFIED | PR #7 CI passed production-foundation scan, TypeScript, production build, dependency audit, fresh database replay, M1 identity/KYC/storage tests, BSM verification test, commerce/payment/payout suites and payout concurrency. |
| Live migration state | VERIFIED | All M1 forward migrations are applied to Supabase project `kllwwurklumhawfsilpd`, including final Seller/Business KYC synchronization. |

**M1 status: VERIFIED.** A new standalone EntizNetStore account can establish Buyer/Seller or Buyer/Seller/Business capability and complete the canonical Supabase-backed verification/storage path without Replit infrastructure. This milestone does **not** mean public commercial launch is approved; the P0/P1 gates below remain authoritative.

Architecture/evidence: `docs/architecture/M1-IDENTITY-KYC-STORAGE.md`, `docs/architecture/ADR-0001-account-capabilities.md`, `scripts/test-m1-identity-kyc-storage.sql`, `scripts/test-m1-bsm-verification.sql`.

---

## M2 — Catalogue & Seller Operations exit gate

**Functional exit condition:** a verified Seller can operate a stable storefront, create and manage a complete product/variant/inventory listing, submit it for independent Admin review, and expose only the approved revision publicly without any Replit catalogue infrastructure.

| Item | Status | Evidence / remaining requirement |
| --- | --- | --- |
| Persisted stable storefront slug | VERIFIED | Unique non-null `profiles_seller.store_slug`; clean slug when available, deterministic collision handling, preserved across store-name edits. |
| Trusted storefront profile mutation | VERIFIED | `/api/seller/storefront` updates store name, bio, shipping and return policies through trusted server authorization; browser profile mutation helpers removed. |
| Store branding | VERIFIED | Storefront settings combine the M1 validated logo/banner pipeline with M2 profile/policy editing. |
| Rich product catalogue | VERIFIED | `seller_save_product_v3` persists canonical product type, descriptions, brand/categories, pricing/cost, shipping/tax metadata, material/weight/age, tags/search and up to 100 variants. |
| Variant/SKU/inventory operations | VERIFIED | Multi-variant options, SKU/barcode, price/cost, stock, inventory policy, weight, shipping and active state are persisted atomically. |
| RPC-only catalogue writes | VERIFIED | Browser direct product/variant/media/category DML revoked; old Seller save RPCs no longer authenticated-executable. |
| Product moderation lifecycle | VERIFIED | `not_submitted → pending → approved/rejected`; only approved + active products of verified Sellers are public. |
| Independent Admin review | VERIFIED | Trusted Admin queue and service-role-only `admin_review_product`; decision + moderation event + admin audit are one transaction. |
| Edit invalidates approval | VERIFIED | Any Seller content/catalogue edit returns the listing to draft/not_submitted before it can reappear publicly. |
| Publication invariant | VERIFIED | Database constraint prevents `active` unless moderation is `approved`, including trusted/internal writes. |
| Seller policy completeness | VERIFIED | Review requires a real Seller return policy and, for shippable products, a real shipping policy; product page no longer fabricates U.S. origin/free delivery/default terms. |
| Inventory reservation safety | VERIFIED | Seller cannot reduce tracked/deny-policy stock below active non-expired checkout reservations. |
| Non-orphanable ownership/history | VERIFIED | `products.seller_id` is required/restricting; product deletion fails when order history exists. |
| Public storefront/product links | VERIFIED | Public storefront uses persisted slug; product pages link to canonical Seller store and expose only approved catalogue rows. |
| Seller operating UX | VERIFIED | Product list/detail/editor show moderation, rejection notes, inventory, Submit for Review, Unpublish/Republish and rich catalogue management states. |
| M2 fresh-database regression gates | VERIFIED | CI verifies structural invariants/indexes, catalogue/moderation isolation, inventory-reservation guard, active-product approval invariant and Seller policy completeness alongside all M1 and commerce/payment/payout suites. |
| Branch release CI | VERIFIED | CI #185 and #187 passed the full release stack; final evidence-head CI #189 again passed foundation, TypeScript, production build, fresh migration replay, all M1/M2, commerce/payment/payout and real concurrency regressions. |
| Live M2 migrations/advisors | VERIFIED | All eight M2 forward migrations are live on `kllwwurklumhawfsilpd`; live baseline is 32 public tables / 32 RLS, 9 intentional deny-by-default tables. Two new FK advisor findings were fixed; remaining M2 `SECURITY DEFINER` Seller RPC warnings are reviewed intentional boundaries. |
| Main merge | VERIFIED | PR #8 merged the exact tested release head into `main` at `de1558d292d2e92fd256796b61e9f9bb47ac2160`. |
| Vercel release evidence | VERIFIED ARTIFACT / HISTORICAL RATE-LIMIT INCIDENT | Exact M2 release-head preview `b5e51be858b81267710d93ee945cf18f5fc1c605` was READY and served HTTP 200 with expected security headers. Normal `main` builds were rejected by the Vercel Hobby build-rate limit. The dashboard production-promotion flow explicitly performs a build using production environment, so promotion must never be described as a guaranteed no-rebuild bypass. Current production runtime is reverified per subsequent milestone rather than inferred from this historical preview. |

**M2 status: ENGINEERING + LIVE DATABASE VERIFIED; MERGED TO MAIN. The M2 artifact was validated, while the Vercel build-rate incident remains part of the broader P0-06 deployment-capacity requirement.**

Architecture/evidence: `docs/architecture/M2-CATALOGUE-SELLER-OPERATIONS.md`, `docs/operations/M2_RELEASE_PROMOTION.md`, `scripts/verify-m2-database-invariants.sql`, `scripts/test-m2-catalog-moderation.sql`, `scripts/test-m2-inventory-reservation-guard.sql`, `scripts/test-m2-active-approval-invariant.sql`, `scripts/test-m2-product-policy-completeness.sql`.

---

## M3 — Marketplace Operations, Admin & EntizNet Integration exit gate

**Combined exit gate:** EntizNetStore can be operated for ordinary marketplace work without opening Supabase manually, and a person entering from EntizNet or directly receives the same linked identity and effective Buyer/Seller/Business permissions with secure handoff/revocation/return semantics.

| Item | Status | Evidence / remaining requirement |
| --- | --- | --- |
| Persistent Buyer cart/address/quote core | VERIFIED | RPC-only cart/address mutation, server-authoritative cart hydration, immutable/versioned quote snapshots and trusted checkout v2 are implemented and covered by clean-database regression. |
| Legacy arbitrary checkout lockout | VERIFIED | `create_checkout_session(jsonb,jsonb,uuid)` is denied to anon/authenticated and retained for trusted compatibility only; checkout v2 is authenticated and validates canonical cart/quote state. |
| Buyer/Seller/Business capability suspension | VERIFIED | Capability-specific state/history, Seller catalogue gating and Buyer commerce guards are enforced without collapsing additive capabilities. |
| EntizNet identity mapping/replay ledger | VERIFIED — DATABASE/CONTRACT | One-to-one links, allowed capability snapshots, handoff replay ledger, safe return-path validation and revocation functions are live and service-role controlled. |
| Linked EntizNet capability authority | VERIFIED — DATABASE/CONTRACT | Linked accounts use the active EntizNet Store capability snapshot plus local suspension as an additional deny; standalone accounts remain supported. |
| Admin account/order operations | VERIFIED | Server-authoritative global account/order search/detail and capability operations are implemented without direct browser operational-table mutation. |
| Refund/dispute operations | VERIFIED | Buyer request/dispute paths, Admin review, provider-neutral refund finalization, payout-claim fail-closed rules and case histories are tested. |
| Escrow/payout/financial console | VERIFIED | Canonical ledgers remain source of truth; Admin financial summary/search and payout preparation/cancellation use trusted boundaries. |
| Catalogue governance | VERIFIED | Audited category/brand operations, safe taxonomy deactivation and active category/brand guards are implemented. |
| Reviews/reports/prohibited products | VERIFIED | Verified-purchase review submission/moderation, marketplace reports and audited prohibited-product enforcement are implemented. |
| Content/notifications | VERIFIED | CMS and notification operations use trusted Admin RPCs; user read-state is owner scoped. |
| RLS/privilege/search-path baseline | VERIFIED LIVE | Final production state: 45 public tables / 45 RLS / zero RLS-disabled. Critical execute grants and SECURITY DEFINER search paths are explicitly verified. |
| Post-rollout advisor hardening | VERIFIED LIVE | All 11 M3 unindexed-FK advisor findings were fixed. The public generic capability helper is no longer browser executable; catalogue RLS uses a non-exposed `app_private` helper. Remaining advisor entries are reviewed intentional deny-by-default tables and owner/state RPCs. |
| Fresh release CI | VERIFIED | CI #333 / run `32680825079` passed exact code head `1ea6918176f09e689588ead0d8bd71d978b48267`: build/typecheck/dependency audit, full clean migration replay, M1/M2/M3 suites, P0 commerce/payment and payout concurrency. |
| Live M3 migrations | VERIFIED | All fourteen forward M3 migrations are live on `kllwwurklumhawfsilpd`; advisor hardening is recorded as `20260824014924_m3_advisor_hardening`. |
| Production data preservation | VERIFIED | After rollout: 16 categories, 6 brands, and zero products/Sellers/Businesses/carts/orders/payments/escrow/payouts/refunds/disputes/reports/reviews/EntizNet links/handoff events. |
| Paired EntizNet issuer branch | VERIFIED — ENGINEERING | EntizNet PR #29 exact head `5558bf1220d57cf38627023e777c977e3f15c431` passed EntizNet CI #123 production build. |
| Store main merge | PENDING | PR #9 must pass final evidence-head CI and merge with expected-head protection. |
| Store Vercel production/runtime | PENDING | After merge, verify actual deployment source/commit, canonical alias, HTTP response, security headers and runtime errors; do not infer production from Git status alone. |
| EntizNet main merge/deployment | PENDING | Merge receiver first, then paired issuer PR #29; verify its deployed runtime. |
| Production handoff secrets + deployed cross-product test | PENDING | Provision signing/verification configuration in secret stores, then verify real deployed login/link, capability consistency, replay rejection, logout/revocation and safe return path. |

**M3 status: ENGINEERING + PRODUCTION DATABASE VERIFIED. Final repository merges, web deployments and deployed cross-product handoff verification remain before the combined milestone is fully production-verified.**

Architecture/evidence: `docs/architecture/M3-MARKETPLACE-OPERATIONS-ENTIZNET-INTEGRATION.md`, `docs/operations/M3_RELEASE_VERIFICATION.md`, `scripts/verify-m3-database-invariants.sql` and the M3 regression suites.

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

The provider-neutral secret contract is documented and the dedicated EntizNetStore Vercel project is established. Supabase production configuration is provisioned without exposing privileged values to browser/mobile code. Real payment-provider merchant/webhook/payout credentials are intentionally not provisioned until an approved processor and contracting legal entity are selected. M3 also requires production EntizNet handoff signing/verification configuration to be provisioned only in server-side secret stores before the deployed integration test.

Before launch, all remaining production credentials must be stored in the deployment secret store, privilege-scoped, environment-isolated, and assigned an owner/rotation procedure. No production secret may live in Git or a browser/mobile bundle.

## P0-03 — Production payment processor end-to-end verification

**Status: IN PROGRESS — external processor onboarding deferred until pre-launch**

Verified internal commerce/payment layer:
- checkout and payment processing are separated by the provider boundary in `docs/architecture/ADR-0002-payment-provider-boundary.md`;
- the marketplace owns server-side price calculation, checkout idempotency, inventory reservation/consumption/release, seller order splitting, payment-session state, escrow and fulfillment state;
- canonical `payment_provider` / `provider_payment_id` references replace processor-specific identity in new application code;
- provider callbacks normalize to `succeeded`, `retryable_failure`, `terminal_failure`, or `cancelled` before touching commerce state;
- exact event replay is deduplicated and provider IDs namespace event identities;
- paid sessions cannot be downgraded by late failures;
- failed/cancelled sessions cannot be reopened by later retryable/terminal callbacks, while a late success against released inventory is rejected as a reconciliation incident;
- legacy Stripe RPC signatures remain compatibility wrappers only and preserve strict Stripe event/outcome validation;
- the public application has a safe `unconfigured` payment state: no external charge is attempted and no fake-payment production route exists;
- clean PostgreSQL 17/Supabase CI continuously exercises the original P0 commerce/security suite plus provider-neutral and terminal-state payment suites;
- Vercel builds of the provider-neutral application are successful.

Still required before real payment processing/public launch:
- select a processor that accepts the final marketplace business model and contracting legal entity;
- implement that provider through the adapter contract rather than rewriting checkout/order logic;
- complete provider sandbox/test payment initialization through the deployed application;
- verify actual signed webhook/callback deliveries, retries, duplicates and out-of-order events at the HTTP boundary;
- verify refunds/partial refunds through the selected real provider where exposed at launch;
- implement provider reconciliation and operational incident procedures.

The missing external processor does **not** block continued engineering or internal commerce-state verification. It remains a hard gate before accepting real payment data or enabling public checkout.

## P0-04 — Authorization/RLS regression suite

**Status: IN PROGRESS**

Automated buyer/seller/cross-account/service-role coverage exists for orders, order items, payment sessions, inventory reservations, escrow, checkout RPCs and fulfillment transitions. Payout coverage verifies seller-only reads, cross-seller isolation, no authenticated payout mutation RPC execution, no authenticated access to raw provider events, and service-role-only payout mutation.

M1 additionally covers multi-capability profile coexistence, Business visibility boundaries, own-vs-cross-seller KYC isolation, no direct authenticated KYC mutation, service-role-only KYC review RPCs, required-document approval gating, atomic audit logging and BSM Seller/Business synchronization.

M2 adds database-level cross-Seller catalogue isolation, RPC-only product mutation, Admin-only moderation, public visibility gating, moderation-history isolation, publication invariants, Seller policy prerequisites and inventory-reservation safety.

M3 extends the reproduced baseline to 45/45 RLS tables and exercises cart/quote/checkout ownership, capability-specific suspension, EntizNet linked authority, Admin account/order operations, refunds/disputes, financial operations, catalogue governance, reviews/reports/prohibited products and content/notifications. Database-level cross-account and trusted-worker boundaries are now extensive.

Still required before public launch: broader deployed HTTP-level anon/buyer/seller/cross-account/admin ownership tests for representative catalogue, messaging, product/branding/media/storefront, Admin and integration routes. Database-level isolation is strong; P0 requires representative end-to-end route coverage too.

## P0-05 — Seller/admin/KYC/storage security completion

**Status: IN PROGRESS**

Verified/implemented security includes:
- private `kyc-documents` bucket with 10MB PDF/JPEG/PNG/WebP restrictions and Seller-scoped signed access;
- KYC object re-download, actual size enforcement and PDF/JPEG/PNG/WebP magic-byte validation instead of trusting browser metadata;
- Seller/Business lifecycle and final approval gated on every mandatory document being approved;
- transactional admin KYC decisions with atomic audit rows and repeat-review protection;
- public `product-media` bucket with server ownership/existence/size/signature verification before product save;
- M2 RPC-only catalogue mutation and independent Admin product moderation;
- M2 product edits invalidate approval before public visibility can return;
- M2 stock edits respect active checkout reservations;
- public `seller-branding` bucket plus usable logo/banner upload UI, server byte validation and replacement cleanup;
- private `message-attachments` bucket plus sender-only upload, participant-only access, participant RLS and integrated message attachment UI;
- trusted server conversation-key access so encryption keys remain behind a browser-denied table boundary;
- M3 verified-purchase review moderation, marketplace report workflow and prohibited-product enforcement with immutable/audited operational evidence;
- no broad client Storage mutation policy and no Replit object-storage dependency.

Still required before public launch: complete HTTP ownership regression coverage for remaining seller/admin/upload routes; explicitly exercise storage/database partial-failure recovery paths; finalize malware/content moderation/scanning policy; and perform the final public-vs-private media-boundary review under production traffic/deployment conditions.

## P0-06 — Production deployment hardening

**Status: IN PROGRESS**

Verified:
- EntizNetStore has a dedicated Vercel project (`entiznetstore`) linked only to `OKenechukwu/EntizNetStore`;
- the incorrectly linked EntizNet Vercel projects were disconnected and no longer consume EntizNetStore builds;
- the canonical Vercel HTTPS alias has served production successfully;
- production build uses the canonical npm lockfile and stale Replit/Yarn/pnpm deployment artifacts are blocked by the foundation guard;
- provider-neutral payment/payout code compiles with both processors intentionally unconfigured;
- M2 final release-head preview was READY and served HTTP 200 with CSP/HSTS and `noindex` protections.

Known operational release issue:
- Vercel Hobby build-rate limiting has rejected normal `main` builds with `upgradeToPro=build-rate-limit`;
- Vercel's dashboard “Promote to Production” confirmation states that a new deployment is built using the production environment, so that path must not be treated as a guaranteed no-build/rate-limit bypass;
- M3 must therefore verify the actual post-merge deployment and canonical alias rather than assuming Git merge equals production promotion.

Still required before public launch:
- restore reliable production deployment capacity/automation so a normal `main` release is not dependent on a rate-limit window;
- canonical owned production domain and DNS/HTTPS validation;
- final production/preview/staging environment isolation review;
- final CSP/header review for the selected payment provider and Supabase flows;
- confirm no debug/test/admin maintenance route is accidentally public;
- structured error/logging review without secret leakage;
- documented deployment rollback/health procedure;
- finalized database migration deployment procedure, including management-generated timestamp drift, and production release checklist.

## P0-07 — Observability and commerce incident response

**Status: OPEN**

Production needs actionable monitoring for payment/payout callback failures, checkout/order/payout inconsistencies, elevated server errors, auth/admin failures, storage failures, database health and EntizNet handoff failures. Define alert ownership and the first incident-response runbook.

## P0-08 — EntizNet identity/capability integration contract

**Status: IN PROGRESS — ENGINEERING/DATABASE CONTRACT VERIFIED; DEPLOYED HANDOFF PENDING**

M3 implements the Store receiver/authority contract and the paired EntizNet issuer branch. Verified engineering evidence includes:
- one-to-one Store↔EntizNet identity mapping with auditable revocation;
- canonical Store capability slugs only (`entiznetstore_buyer`, `entiznetstore_seller`, `entiznetstore_business`);
- linked EntizNet capability snapshots become upstream Store capability authority while local Store suspension remains an additional deny;
- standalone Store accounts continue to work without EntizNet linkage;
- replay-resistant handoff ledger, issuer/audience/expiry checks and safe relative return paths;
- Store handoff and identity-control RPCs are service-role-only;
- EntizNet counterpart PR #29 uses confirmed real-session identity, active `user_capabilities`, a 90-second Ed25519 assertion, one-time `jti`, POST handoff and canonical `/entizstore` entry;
- EntizNet PR #29 exact head `5558bf1220d57cf38627023e777c977e3f15c431` passed CI #123 production build;
- Store exact code head `1ea6918176f09e689588ead0d8bd71d978b48267` passed CI #333 and all 14 Store M3 migrations are verified live.

Still required before EntizNet-linked production launch:
- merge and deploy the Store receiver first;
- merge and deploy the paired EntizNet issuer;
- provision signing/verification keys and integration configuration in server-side secret stores with documented rotation ownership;
- run a deployed real-session handoff proving same-account link, Buyer/Seller/Business consistency, replay rejection, safe return path, logout/revocation and re-entry behavior;
- verify integration failures surface operationally without leaking token/assertion material.

## P0-09 — Seller payout/disbursement end-to-end verification

**Status: IN PROGRESS — external payout provider onboarding deferred until pre-launch**

Verified internal payout layer:
- `docs/architecture/ADR-0003-payout-provider-boundary.md` defines a provider-neutral payout contract independent of the future disbursement processor;
- payout requests are idempotent per seller and claim eligible escrow atomically;
- only held, undisputed escrow from paid + delivered + fulfilled seller orders older than the trusted-server eligibility cutoff can be claimed;
- payout creation reserves escrow without marking money released;
- each escrow transaction can have at most one active `reserved`/`settled` payout claim;
- terminal payout failure or operator cancellation releases the payout claim while preserving underlying held escrow for a safe later request;
- only verified provider success changes escrow from `held` to `released` and settles payout items;
- exact provider-event replay is deduplicated and late failure cannot downgrade a succeeded payout;
- late success against a locally terminal request is rejected as a manual reconciliation incident;
- ambiguous provider initialization failures intentionally keep escrow reserved instead of risking a duplicate transfer;
- seller payout destination data stays server-only in `profiles_seller_private`;
- `PAYOUT_PROVIDER=unconfigured` fails closed and there is no public fake-payout endpoint;
- CI verifies the full payout state machine and launches two real concurrent PostgreSQL sessions against one eligible escrow row; exactly one request may claim it.

Still required before real seller disbursement/public launch:
- choose an approved payout-capable processor/legal-entity relationship;
- implement the real payout adapter with provider-side idempotency keyed by internal payout request ID;
- approve and configure the production `PAYOUT_HOLD_DAYS` release policy;
- complete seller payout-account onboarding/validation appropriate to the provider;
- verify actual signed provider callbacks, duplicates, retries, terminal failures and out-of-order events;
- define provider reconciliation, payout support and money-movement incident procedures;
- exercise sandbox payouts end-to-end before enabling production disbursement.

The missing external payout provider does **not** block continued internal marketplace engineering. It is a hard gate before money is actually disbursed to sellers.

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