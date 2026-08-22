# M3 — Marketplace Operations, Admin & EntizNet Integration

**Schedule:** September 5–14, 2026  
**Status:** ACTIVE — canonical combined milestone  
**Note:** This combines the former M3 Marketplace Operations & Admin and M4 EntizNet Integration milestones. Some overlap with M2 is intentional.

## Objective

Deliver the operational control plane and cross-product identity boundary required to run EntizNetStore as a real marketplace both independently and as a secure capability inside EntizNet.

This milestone is complete only when ordinary marketplace operations can be performed through trusted EntizNetStore interfaces without direct Supabase intervention, and the same human account has consistent Buyer, Seller and Business capabilities regardless of whether they enter EntizNetStore directly or through EntizNet.

## Scope A — Marketplace Operations & Admin

- proper admin dashboard;
- seller management;
- buyer management;
- products moderation;
- category/brand management;
- KYC queue;
- orders;
- refunds;
- disputes;
- escrow;
- payouts;
- platform revenue;
- transaction search;
- audit log;
- reviews moderation;
- reports;
- prohibited products;
- seller suspensions;
- buyer suspensions;
- content management;
- notifications;
- operational dashboards.

## Scope B — EntizNet Integration

- integration contract;
- secure entry from EntizNet;
- identity mapping;
- Buyer capability;
- Seller capability;
- Business capability;
- account linking;
- session handling;
- permission consistency;
- logout/revocation;
- secure return links;
- no duplicated identity source;
- standalone users remain supported.

## Architecture principles

### Identity and capability ownership

- EntizNetStore remains a distinct product and repository boundary.
- EntizNetStore continues to use its own Supabase project as its canonical marketplace data store unless an explicit architecture decision changes that.
- EntizNet integration must not create a second permanent account/role truth inside EntizNetStore.
- Buyer, Seller and Business capabilities are additive; no integration path may collapse them into mutually exclusive single-role assumptions.
- The integration contract maps a verified external EntizNet identity to the corresponding EntizNetStore auth/account identity without duplicating passwords or accepting editable client claims as authority.
- Standalone EntizNetStore registration/login remains supported.

### Secure cross-product entry

- Entry from EntizNet uses a short-lived, signed, single-use or replay-resistant server-validated handoff.
- Handoff payloads identify issuer, audience, subject, issuance/expiry, nonce/jti, requested return path and capability claims/version where appropriate.
- EntizNetStore validates issuer, audience, signature, expiry, replay state and allowed return targets before establishing or linking a session.
- Raw auth tokens, service-role credentials and permanent shared secrets are never placed in URLs or client storage.
- Return links are allow-listed and cannot become open redirects.

### Account linking and identity mapping

- Mapping between EntizNet identity and EntizNetStore identity is explicit, unique and auditable.
- Linking requires a trusted proof of both sides; email equality by itself is not sufficient authority for linking existing accounts.
- Duplicate EntizNet identities cannot link to one EntizNetStore account unless the contract explicitly supports a controlled merge flow.
- One EntizNet identity cannot silently create multiple EntizNetStore identities.
- Revocation/unlink events are recorded and reflected on future entry attempts.

### Sessions, logout and revocation

- EntizNet-origin sessions are distinguishable in audit/session metadata without changing user permissions.
- EntizNetStore re-evaluates local account suspension and marketplace capability state on trusted operations even when the entry originated in EntizNet.
- Logout behavior and upstream revocation are defined explicitly; revocation must prevent new trusted handoffs and invalidate/expire linked Store sessions according to the integration contract.
- Local Seller/Buyer suspension cannot be bypassed by re-entering through EntizNet.

### Admin access

- Admin capability is server-authoritative and cannot be granted by client state, URL parameters, localStorage, editable profile fields or EntizNet capability claims.
- Every sensitive admin route and API verifies trusted Admin authorization server-side.
- Direct browser mutation of protected operational tables is prohibited where trusted RPC/API boundaries are required.
- High-risk actions are attributable to the acting Admin and retain reasons/history.

### Seller and Buyer management

Operational tools support searchable account lists/detail views, capability and verification visibility, Seller/Buyer suspension/restoration, operational reasons/notes, related KYC/orders/disputes/reviews/payouts/audit history, and consistent enforcement across standalone and EntizNet-origin sessions.

### Catalogue and moderation operations

- product moderation queue/history;
- approve/reject/request-correction workflows;
- category and brand CRUD with validation and safe deactivation/deletion semantics;
- prohibited-product rules and enforcement records;
- review moderation/report handling;
- product/Seller suspension reflected consistently in storefront visibility, cart eligibility and checkout.

### KYC operations

- unified KYC queue;
- secure signed document access only;
- approve/reject/request-information lifecycle;
- Seller/Business verification synchronization where required;
- full review/final-decision audit history.

### Orders, refunds and disputes

- global order search/detail;
- Buyer/Seller/payment/fulfillment visibility;
- trusted state-transition operations only;
- provider-neutral refund request/execution architecture;
- dispute lifecycle with evidence/status/owner/history;
- no arbitrary browser-side order/payment state editing.

### Escrow, payouts and platform revenue

- escrow ledger and release eligibility visibility;
- Seller payout queue/operational controls;
- payout reconciliation/status;
- platform fee/revenue reporting from canonical ledgers/orders;
- transaction search across orders, payment sessions, refunds, escrow and payouts;
- money-moving actions remain fail-closed until approved payment/payout providers are configured.

### Audit, reports, content and notifications

- searchable Admin audit log;
- user/product/review/order/dispute reports;
- prohibited-product enforcement;
- CMS for marketplace-controlled content;
- trusted notification creation/management;
- no debug/test broadcast paths in production;
- delivery/failure state surfaced where operationally relevant.

### Operational dashboards

Dashboards prioritize actionable marketplace health:

- pending KYC;
- products awaiting moderation;
- Seller/Buyer suspensions;
- open disputes/reports;
- orders by state;
- refunds requiring action;
- held/releasable escrow;
- payout queue/status;
- platform revenue/fees;
- payment/payout failures requiring reconciliation;
- recent audit/security actions;
- EntizNet integration/link/session failures or revocations requiring attention.

## Execution order

1. **Trusted commerce foundation** — finish persistent cart/address/quote/checkout snapshot work already underway so operational order/refund/dispute tooling rests on authoritative records.
2. **Identity/suspension enforcement foundation** — establish unified local capability state, Seller/Buyer suspension semantics and integration mapping/revocation tables so both Admin and EntizNet entry enforce the same permissions.
3. **EntizNet handoff contract** — signed short-lived entry, account linking, standalone-account coexistence, session origin metadata, return-link allow-list and revocation behavior.
4. **Admin control plane** — account management, KYC, catalogue, orders, refunds, disputes, escrow, payouts, revenue, transaction search, reports, reviews, content and notifications.
5. **Operational dashboards & regressions** — actionable metrics, audit/reconciliation surfaces, database/HTTP/cross-product authorization tests, failure/recovery states and launch-blocker closure.

## Engineering method

- inspect and reuse M0–M2 commerce/KYC/moderation/order/payment/escrow/payout state machines;
- finish the trusted persistent cart/checkout foundation already in progress because M3 operational tooling depends on reliable commerce records;
- forward migrations only;
- RLS on every exposed table and least privilege throughout;
- service-role and integration secrets remain server-only;
- Admin and integration inputs are validated server-side;
- high-risk mutations are atomic/idempotent where applicable and auditable;
- every operational list/detail/action surface gets loading, empty, error and recovery states;
- add database, HTTP authorization and cross-product integration regressions;
- keep `LAUNCH_BLOCKERS.md` synchronized.

## Combined exit gate

M3 passes only when **both** are true:

1. **EntizNetStore can be operated for ordinary marketplace work without opening Supabase manually.**
2. **The same person entering through EntizNet or directly through EntizNetStore receives the same linked account and the same effective Buyer/Seller/Business permissions, with secure session, logout, revocation and return-link behavior.**

A polished Admin dashboard without trusted operational APIs does not pass. A working EntizNet deep link that creates duplicate identity/permission truth does not pass. Both the operations plane and identity integration boundary must be production-safe together.
