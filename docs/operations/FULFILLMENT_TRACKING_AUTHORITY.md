# EntizNetStore Fulfillment, Settlement & Tracking Authority

Last reviewed: **2026-09-04**

This document defines the V1 authority boundary for Seller fulfillment, shipment tracking, Buyer delivery history, trusted receipt confirmation and Seller payout eligibility.

## Core invariant

**Fulfillment records delivery facts. It does not create financial settlement authority and it does not release money.**

A Seller can move a paid order through the legal fulfillment state machine, but Seller-controlled `delivered`, `fulfilled` and `delivered_at` facts cannot by themselves start the payout hold clock or make escrow payout-eligible.

Independent trusted settlement confirmation is required:

- the canonical Buyer may confirm receipt after a paid order is delivered and fulfilled; or
- a verified Admin may create an exceptional confirmation after independent review, with a mandatory reason and immutable Admin audit evidence.

Only after trusted confirmation has aged past the configured payout hold, while the order remains paid/delivered/fulfilled, escrow remains held, and no active dispute or refund exists, may the trusted payout worker reserve that escrow. Provider-confirmed payout success is the only normal authority that changes escrow from `held` to `released`.

Seller fulfillment code, routes and RPCs must never update or delete `escrow_transactions`.

## Authoritative fulfillment state machine

The marketplace derives whether shipping is required from immutable order-item purchase facts rather than client input.

Physical or mixed orders:

`confirmed -> processing -> shipped -> delivered`

- `processing` requires a paid order.
- `shipped` requires at least one shipping item plus a bounded, single-line carrier and tracking number.
- shipping order-items are marked fulfilled atomically with the shipment transition.
- `delivered` promotes the complete order and all remaining items to fulfilled.

Digital-only orders:

`confirmed -> processing -> delivered`

- no carrier, tracking number or synthetic `shipped` state is required or permitted.
- a stale or malicious request attempting to mark a digital-only order shipped fails closed.
- digital fulfillment remains logistics evidence only; it does not bypass trusted settlement confirmation.

Illegal jumps, unpaid fulfillment, cross-Seller ownership attempts, malformed tracking details and conflicting retries are rejected in the database authority.

## Fulfillment transaction authority

The exposed API calls:

`public.transition_seller_order(uuid,text,text,text)`

The public function is a thin `SECURITY INVOKER` wrapper. Privileged implementation lives at:

`app_private.transition_seller_order_authoritative(uuid,text,text,text)`

The private function is `SECURITY DEFINER`, pins an empty search path, derives the actor from `auth.uid()`, row-locks the order, proves Seller ownership and payment state, derives shipping requirements from order items and performs all transition writes in one PostgreSQL transaction.

A successful transition atomically changes:

1. canonical order state;
2. affected order-item fulfillment state;
3. one immutable fulfillment-event record;
4. one Buyer notification.

If any write fails, PostgreSQL rolls the complete transition back.

Exact retries after a lost HTTP response are idempotent. The order row lock serializes concurrent duplicate requests so only one event and one notification can be created. A shipped retry carrying different carrier/tracking details is a conflict rather than an overwrite.

## Immutable fulfillment evidence

`public.order_fulfillment_events` is the canonical shipment/delivery evidence ledger.

- authenticated Buyer/Seller participants receive RLS-scoped `SELECT` only;
- `service_role` also receives `SELECT` only;
- direct API `INSERT`, `UPDATE`, `DELETE` and `TRUNCATE` are revoked from authenticated and service roles;
- only the postgres-owned private transition authority appends normal application evidence;
- an immutability trigger rejects row updates and deletes;
- one `(order_id, to_status)` record prevents duplicate transition evidence.

Do not add a general Admin or service-role mutation path to this ledger. Future corrections must be additive and auditable rather than rewriting historical evidence.

## Trusted settlement evidence

`private.order_settlement_confirmations` is the financial handoff between logistics and payout eligibility. It is outside the exposed Data API schema.

The table records:

- canonical order, Buyer and Seller identity;
- authority type (`buyer` or `admin`);
- exact confirming actor;
- idempotency key;
- server-controlled confirmation timestamp;
- bounded reason/metadata.

Direct table access is revoked from `anon`, `authenticated` and `service_role`. Even trusted service code cannot manufacture a confirmation by inserting a row. Runtime authority flows through constrained functions.

Buyer confirmation:

`public.confirm_buyer_order_receipt(uuid,uuid)`

The implementation derives the actor from `auth.uid()`, locks the canonical order and requires that actor to equal the order's `buyer_id`. The browser cannot supply a Buyer ID, Seller ID, payout cutoff or escrow instruction. Paid + delivered + fulfilled state is required, and an active dispute or active refund blocks confirmation.

The Buyer confirmation is idempotent and creates exactly one Seller notification. Confirmation does **not** release escrow.

Admin fallback:

`public.admin_confirm_order_settlement(uuid,uuid,text,uuid)`

This is service-role-only. It verifies the supplied Admin identity against Auth Admin metadata, requires a meaningful reason and appends an immutable `order_settlement_confirmed` Admin audit record when a new confirmation is created.

Confirmation timestamps are server-controlled using PostgreSQL transaction time. Callers cannot backdate the payout hold clock.

Settlement evidence is immutable: update/delete attempts are rejected by trigger.

## Payout reservation and finalization

`public.request_seller_payout(...)` is trusted-server-only and requires all of the following for each claimed escrow row:

- verified Seller;
- escrow `held`, positive and not directly marked disputed;
- canonical order Seller matches payout Seller;
- canonical order remains `paid`, `delivered` and `fulfilled` with delivery timestamp;
- trusted settlement confirmation exists and its Buyer/Seller identity matches the canonical order;
- `confirmation.confirmed_at <= eligibility cutoff`;
- no `open`/`under_review` order dispute;
- no `requested`/`approved`/`processing` refund;
- escrow has no other reserved/settled payout claim.

The hold clock therefore starts from independent settlement confirmation, **never** Seller `delivered_at`.

`public.finalize_seller_payout_v1(...)` does not trust the earlier reservation blindly. When a provider reports success it re-locks the payout request, reserved payout items, escrow rows and canonical orders, then re-validates settlement evidence, order state, dispute state and refund state immediately before money changes state.

Refund/dispute writers serialize on the same canonical order row. A refund or dispute opened after payout reservation therefore blocks finalization instead of racing escrow release.

If any authority changed, payout success fails closed for manual reconciliation and escrow remains held.

## Buyer and Seller read model

Buyer and Seller order screens load canonical orders first, then load fulfillment events separately and group them by order id. This separation is intentional: order visibility must not depend on the new event relation existing during a production migration-convergence window.

The shared `OrderFulfillmentTimeline` renders the same event evidence to both participants. Seller-supplied carrier/tracking values are displayed as text and are not converted into arbitrary external links.

Legacy orders created before the event ledger use canonical order-level status, carrier, tracking and timestamps as a read-only fallback.

For paid/delivered/fulfilled Buyer orders, the Buyer page separately reads participant-scoped settlement status through `get_order_settlement_confirmation`. When no confirmation exists and authority is ready, an accessible **Confirm receipt** control is shown. The control explains that confirmation starts the Seller payout hold period and that refunds/disputes still block payout.

A browser retry reuses the same idempotency key until success. After confirmation, the server-rendered order state shows confirmation provenance/time and suppresses the mutation control.

## Migration-safe deployment interlock

The historical production schema contains an older RPC named `transition_seller_order`. New application code must never infer that the correct authority exists merely because that name resolves.

Before invoking Seller fulfillment, the Seller status route positively probes authenticated visibility of `order_fulfillment_events`. If the ledger is missing, unavailable, hidden by stale PostgREST schema cache or otherwise cannot be read, the route returns HTTP `503`, fixed code `fulfillment_authority_unavailable`, `Cache-Control: no-store`, and bounded `Retry-After` guidance. It does **not** call the legacy behavior.

Seller order pages use the event read as their UI readiness probe. If it fails, existing order state remains readable, mutation controls disappear and no state changes.

Buyer settlement state is also loaded separately. If the settlement RPC is not ready, Buyer order state remains readable and receipt-confirmation controls are suppressed. The receipt API converts missing settlement authority into a non-cacheable temporary failure rather than recreating financial authority in application code.

This makes both production ordering scenarios safe:

1. **Application deploy becomes active before migration:** reads remain available; new fulfillment/settlement mutations fail closed until authority is visible.
2. **Migration is applied before the new application finishes deploying:** previous reads remain compatible while the database already enforces the stronger money invariant.

## Release sequence

For a release containing these migrations:

1. Require all exact-head PR gates green, including dedicated Fulfillment Authority Security and exact-head Vercel Preview READY.
2. Reconcile live Supabase migration history and capture the normal recovery checkpoint required by `PRODUCTION_RELEASE.md`.
3. Apply/rehearse forward migrations first in the EntizNetStore development environment and run structural, adversarial and advisor verification.
4. Merge only the pinned, fully verified exact head into `main`.
5. Coordinate production migration and exact merge-SHA Vercel deployment according to the production release runbook; never rewrite an applied migration.
6. Run live structural/privilege verification and Supabase security/performance advisors after migration.
7. Require the exact merge-SHA Vercel deployment to become READY.
8. Verify the canonical production endpoint, `/api/health`, runtime logs and non-mutating authorization/readiness evidence.
9. Never exercise a real customer order merely to prove production deployment. Use isolated verification identities only when explicitly available.

If migration verification fails, stop application promotion/traffic expansion. Correct defects with a new forward migration.

## Failure-before-user release gate

`.github/workflows/fulfillment-authority-security.yml` must remain a required exact-head gate. It proves:

- static architecture boundaries and zero fulfillment-driven escrow mutation;
- fresh zero-to-latest Supabase migration replay;
- fulfillment and settlement function privilege/search-path invariants;
- hidden settlement table direct-access denial;
- authenticated/service-role read-only fulfillment ledger permissions;
- cross-account and unpaid-order rejection;
- illegal transitions and malformed tracking rejection;
- deliberately injected mid-transaction evidence failure rolls earlier writes back;
- digital-only orders skip shipping and reject fabricated tracking;
- service role cannot forge fulfillment or settlement evidence;
- Seller/self/unrelated-Buyer settlement confirmation is denied;
- trusted Buyer/Admin confirmation is idempotent and auditable;
- Seller-delivered timestamps cannot bypass the settlement hold;
- active refund/dispute blocks payout selection/finalization;
- blocked payout finalization leaves escrow and reservations unchanged;
- concurrent payout and fulfillment claims remain single-writer;
- real authenticated Seller -> Buyer fulfillment -> Buyer receipt-confirmation browser flow;
- migration-convergence simulation keeps existing reads available while mutations fail closed;
- WCAG A/AA on critical authenticated Seller/Buyer states;
- Buyer confirmation still leaves escrow held pending payout authority.

A failure in any gate disqualifies that commit from merge. Fix the root cause on a new SHA and rerun all exact-head evidence.
