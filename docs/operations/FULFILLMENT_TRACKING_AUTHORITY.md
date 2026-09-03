# EntizNetStore Fulfillment & Tracking Authority

Last reviewed: **2026-09-03**

This document defines the V1 authority boundary for Seller fulfillment, shipment tracking, Buyer delivery history and the relationship between delivery and Seller payout eligibility.

## Core invariant

**Fulfillment records delivery facts. It does not release money.**

Seller delivery may make an otherwise eligible held escrow row available to the separate payout ledger, but only provider-confirmed payout settlement may change escrow from `held` to `released`. Seller fulfillment code, routes and RPCs must never update or delete `escrow_transactions`.

The payout ledger remains authoritative for money release and requires, among other controls, a paid order that is `delivered`, `fulfilled`, has a delivery timestamp and is not under dispute.

## Authoritative state machine

The marketplace derives whether shipping is required from the immutable order-item purchase facts rather than from client input.

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
- delivery/fulfillment can make the order payout-eligible, but escrow remains held until the payout authority settles it.

Illegal jumps, unpaid fulfillment, cross-Seller ownership attempts, malformed tracking details and conflicting retries are rejected in the database authority.

## Transaction authority

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

If any of those writes fails, PostgreSQL rolls the complete transition back.

Exact retries after a lost HTTP response are idempotent. The row lock serializes concurrent duplicate requests so only one event and one notification can be created. A shipped retry carrying different carrier/tracking details is a conflict rather than an overwrite.

## Immutable fulfillment evidence

`public.order_fulfillment_events` is the canonical shipment/delivery evidence ledger.

- authenticated Buyer/Seller participants receive RLS-scoped `SELECT` only;
- `service_role` also receives `SELECT` only;
- direct API `INSERT`, `UPDATE`, `DELETE` and `TRUNCATE` are revoked from authenticated and service roles;
- only the postgres-owned private transition authority appends normal application evidence;
- an immutability trigger rejects row updates and deletes;
- one `(order_id, to_status)` record prevents duplicate transition evidence.

Do not add a general Admin or service-role mutation path to this ledger. Any future correction model must be additive and auditable rather than rewriting historical fulfillment evidence.

## Buyer and Seller read model

Buyer and Seller order screens load canonical orders first, then load fulfillment events separately and group them by order id. This separation is intentional: order visibility must not depend on the new event relation existing during a production migration-convergence window.

The shared `OrderFulfillmentTimeline` renders the same event evidence to both participants. Seller-supplied carrier/tracking values are displayed as text and are not converted into arbitrary external links.

Legacy orders created before the event ledger use canonical order-level status, carrier, tracking and timestamps as a read-only fallback.

## Migration-safe deployment interlock

The historical production schema already contains an older RPC named `transition_seller_order`. Therefore new application code must never infer that the correct authority exists merely because that function name resolves.

Before invoking the RPC, the Seller status route positively probes authenticated visibility of `order_fulfillment_events`. If the ledger is missing, unavailable, hidden by a stale PostgREST schema cache or otherwise cannot be read, the route returns:

- HTTP `503`;
- fixed code `fulfillment_authority_unavailable`;
- `Cache-Control: no-store`;
- bounded `Retry-After` guidance.

It does **not** call the same-named legacy RPC.

Seller order pages use the separate event read as their UI readiness probe. If it fails:

- existing order state remains readable;
- mutation controls are suppressed;
- a temporary availability message is rendered;
- no state is changed.

Buyer order pages similarly continue to render existing order state and legacy tracking facts if detailed timeline evidence is temporarily unavailable.

This makes both production ordering scenarios safe:

1. **Application deploy becomes active before migration:** reads remain available; Seller mutations fail closed until the ledger is visible.
2. **Migration is applied before the new application finishes deploying:** the previous application remains compatible with the replacement RPC signature; digital-only stale shipping attempts may fail closed until the new UI arrives, but money/order safety is preserved.

## Release sequence

For a release containing this migration:

1. Require all exact-head PR gates green, including the dedicated Fulfillment Authority Security workflow and exact-head Vercel Preview READY.
2. Reconcile live Supabase migration history and capture the normal recovery checkpoint required by `PRODUCTION_RELEASE.md`.
3. Merge only the pinned exact head into `main`.
4. As the Vercel production deployment builds, apply the new forward migration to the verified EntizNetStore Supabase project.
5. Run live structural/privilege verification and Supabase security/performance advisors.
6. Require the exact merge-SHA Vercel deployment to become READY.
7. Verify the canonical production endpoint, `/api/health.version`, runtime logs and fail-closed route behavior.
8. Never exercise a real customer order merely to prove production deployment. Use non-mutating authorization/readiness evidence unless dedicated isolated production verification identities are explicitly available.

If migration verification fails, stop application promotion/traffic expansion. Do not rewrite or reverse the applied migration; correct defects with a new forward migration.

## Failure-before-user release gate

`.github/workflows/fulfillment-authority-security.yml` must remain a required exact-head gate for this authority. It proves:

- static architecture boundaries and no escrow mutation;
- fresh zero-to-latest Supabase migration replay;
- public/private function privilege and search-path invariants;
- authenticated/service-role read-only event ledger permissions;
- cross-account and unpaid-order rejection;
- illegal transitions and malformed tracking rejection;
- deliberately injected mid-transaction event failure rolls earlier writes back;
- digital-only orders skip shipping and reject fabricated tracking;
- service_role cannot forge fulfillment evidence;
- duplicate concurrent requests create exactly one transition event/notification;
- real authenticated Seller -> Buyer physical fulfillment flow;
- migration-convergence simulation where authenticated ledger SELECT is temporarily revoked: Seller reads continue, controls disappear, mutation returns 503, and order/events/notifications/escrow remain unchanged;
- WCAG A/AA on the critical authenticated Seller/Buyer states.

A failure in any of these gates disqualifies that commit from merge. Fix the root cause on a new SHA and rerun all exact-head evidence.
