# M3 — Marketplace Operations & Admin

**Schedule:** September 5–11, 2026  
**Status:** PLANNED — canonical milestone  
**Note:** Some overlap with M2 is intentional.

## Objective

Build the operational control plane required to run EntizNetStore day to day without ordinary marketplace operations requiring direct Supabase access.

M3 is not merely an admin UI pass. Every operational action must use trusted server-side authorization, auditable mutations, least privilege, clear failure/recovery states, and explicit ownership boundaries.

## Scope

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

## Operational architecture requirements

### Admin access

- Admin capability is server-authoritative and cannot be granted by client state, URL parameters, localStorage, or editable profile fields.
- Every sensitive admin route and API must verify admin authorization server-side.
- Direct browser mutation of protected operational tables is prohibited where trusted RPC/API boundaries are required.
- Admin actions that change marketplace state must be attributable to the acting admin.

### Seller and Buyer management

Admin operations must support at minimum:

- searchable account lists and detail views;
- verification/capability state visibility;
- Seller/Buyer suspension and restoration through trusted audited actions;
- operational notes/reasons where state changes require them;
- links to related orders, KYC, disputes, reviews, payouts, and audit history;
- no permanent single-role assumptions: Buyer, Seller, Business and future EntizNet-linked capabilities remain additive.

### Catalogue operations

- product moderation queue and history;
- approve/reject/request-correction workflows through trusted APIs/RPCs;
- category and brand management with validation and safe deletion/deactivation semantics;
- prohibited-product rules and enforcement state;
- review moderation and report handling;
- product/Seller suspension effects must be reflected consistently in storefront availability and checkout eligibility.

### KYC operations

- unified KYC queue;
- document review with secure signed access only;
- approve/reject/request-information lifecycle;
- Seller/Business verification synchronization where required by capability architecture;
- audit trail for every review and final decision.

### Orders, refunds and disputes

- global order search and detail view;
- Buyer/Seller/order/payment/fulfillment state visibility;
- authorized operational interventions only through trusted state transitions;
- refund request and refund execution model that remains provider-neutral until a real payment adapter is configured;
- dispute lifecycle with evidence/status/owner/history;
- no direct arbitrary order/payment state edits from the browser.

### Escrow, payouts and revenue

- escrow ledger visibility;
- Seller payout requests and operational controls;
- payout provider status/reconciliation surfaces;
- platform fee and marketplace revenue reporting based on ledger/order records rather than client calculations;
- transaction search across orders, payment sessions, escrow and payouts;
- money-moving actions remain fail-closed while external payment/payout providers are unconfigured.

### Audit, reports and moderation

- searchable admin audit log;
- user/product/review/order/dispute report queue;
- prohibited-product enforcement records;
- state-change reasons retained where required;
- security-sensitive audit records remain browser-denied except through explicitly authorized admin APIs.

### Content and notifications

- operational content-management surface for marketplace-controlled content;
- notification creation/management through trusted boundaries;
- no debug/test broadcast paths in production;
- notification delivery/failure state must be visible where operationally relevant.

### Operational dashboards

Dashboards should surface actionable marketplace health rather than decorative metrics. At minimum cover:

- pending KYC;
- products awaiting moderation;
- Seller/Buyer suspensions;
- open disputes/reports;
- orders by operational state;
- refunds requiring action;
- held/releasable escrow;
- payout queue/status;
- platform revenue/fees;
- payment/payout failures requiring reconciliation;
- audit/security-relevant recent actions.

## Engineering rules

- inspect existing M0–M2 implementations before adding new admin paths;
- reuse canonical commerce, KYC, moderation, order, payment, escrow and payout state machines instead of creating parallel admin-only logic;
- forward migrations only;
- strong RLS on every exposed table;
- service-role secrets never reach the client;
- admin APIs validate input and enforce authorization server-side;
- high-risk mutations must be atomic/idempotent where applicable and produce audit history;
- all list/detail/action pages need loading, empty, error and recovery states;
- add database and HTTP authorization regressions for admin operations;
- keep LAUNCH_BLOCKERS.md synchronized as M3 closes or exposes operational blockers.

## Exit gate

**We can operate EntizNetStore without opening Supabase manually for ordinary marketplace operations.**

Passing this gate requires both UI coverage and trusted operational APIs. A polished dashboard that still requires direct SQL/Table Editor intervention for routine Seller, Buyer, catalogue, KYC, order, refund, dispute, escrow, payout, moderation, content or notification work does not pass M3.
