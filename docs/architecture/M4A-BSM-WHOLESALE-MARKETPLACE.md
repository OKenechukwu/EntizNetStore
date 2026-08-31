# M4A — BSM Wholesale Marketplace Architecture

## Status

M4A introduces the V1 Business/BSM wholesale marketplace as an extension of EntizNetStore's canonical M3 identity, catalogue, cart, quote, checkout, order and inventory authority.

It does **not** create a parallel wholesale payment stack, a second order model, or a permanent single-role Business identity.

Production promotion is separately gated by `docs/operations/M4A-RELEASE-VERIFICATION.md`.

## Product boundary

A verified Business/BSM account can participate in multiple trading capacities at once:

- brand;
- supplier;
- manufacturer;
- distributor;
- wholesaler;
- retailer;
- other.

These are additive business metadata/capabilities. They do not replace the canonical Buyer, Seller, Business or Admin capability model and must not become mutually exclusive permanent account roles.

A wholesale supplier therefore uses the same canonical identity and Seller catalogue authority that powers retail commerce. A wholesale purchaser uses the same canonical Buyer/cart/checkout authority plus an active, verified Business capability.

## Canonical data model

### `business_trading_roles`

Stores additive BSM trading metadata.

Security properties:

- RLS enabled;
- anonymous access denied;
- authenticated reads remain policy-scoped;
- browser clients cannot directly insert/update/delete;
- writes go through `business_set_trading_roles(text[])`;
- one primary-role invariant is database-enforced;
- the RPC resolves `auth.uid()` and never accepts an arbitrary target user.

### `wholesale_offers`

Binds a Seller-owned wholesale offer to an existing canonical product and variant.

Core fields include:

- Seller, product and variant identity;
- lifecycle status;
- minimum order quantity (MOQ);
- order multiple/increment;
- unit label;
- optional case-pack size;
- lead time;
- optional Incoterm;
- optional start/end availability window.

An active offer is only usable when the underlying catalogue and identities remain eligible. Activation requires an active, approved product, active variant, verified Seller and verified Business supplier.

### `wholesale_offer_tiers`

Stores authoritative quantity-tier unit prices in integer cents.

Invariants include:

- first tier equals MOQ;
- tier quantities are unique;
- each later tier is aligned to the offer's MOQ-relative order increment;
- higher-volume tiers cannot become more expensive than the preceding tier;
- browser clients have no direct mutation authority.

## Quantity semantics

The canonical wholesale quantity rule is:

```text
valid quantity = MOQ + (n × orderMultiple), where n >= 0
```

The order multiple is an **increment from the MOQ**, not a divisor of the MOQ.

Example:

```text
MOQ = 12
orderMultiple = 5
valid = 12, 17, 22, 27, 32, ...
invalid = 15
```

This rule is enforced consistently in:

- Seller offer tier validation;
- Business sourcing UI;
- `buyer_set_wholesale_cart_item(uuid, integer)`;
- cart integrity triggers;
- canonical cart hydration;
- final `create_checkout_session_v2(...)` revalidation;
- database, HTTP and browser regression gates.

The original M4A foundation temporarily coupled MOQ divisibility to the order multiple. That unshipped assumption is removed through the forward migration `20260830063500_m4a_moq_relative_multiple_alignment.sql`; applied migration history must never be rewritten.

## Offer mutation authority

`business_save_wholesale_offer(...)` is the canonical offer write path.

It is `SECURITY DEFINER` with a fixed `search_path = pg_catalog, public, app_private` and is explicitly denied to anonymous callers.

Before mutation it enforces:

- authenticated identity;
- Business profile existence;
- Seller profile existence;
- active Business capability;
- active Seller capability;
- product/variant ownership;
- numeric bounds;
- lifecycle/status validity;
- Incoterm allow-list;
- availability-window validity;
- tier shape, ordering, MOQ alignment and price monotonicity;
- verified active catalogue prerequisites before activation.

Offer edits are transaction-atomic. Invalid tier edits must not partially delete valid tiers or alter the previously valid offer state.

## Business-only price visibility

Wholesale price is not public catalogue data.

A purchasing account only receives active B2B offers/tiers when it has:

- a canonical Buyer profile;
- a verified Business profile;
- an active Buyer capability;
- an active Business capability.

The supplier must simultaneously have:

- verified Seller status;
- verified Business status;
- active Seller capability;
- active Business capability;
- eligible active/approved product;
- active variant;
- active offer within its availability window.

If these conditions stop being true, wholesale offer/tier visibility fails closed.

Ordinary Buyers and anonymous users must not receive B2B price data.

## Canonical cart integration

M4A extends `cart_items` rather than introducing a wholesale cart table.

Each line has an explicit `purchase_mode`:

- `retail`;
- `wholesale`.

Wholesale lines reference `wholesale_offer_id`. Retail and wholesale lines for the same variant remain distinct through the `(cart_id, variant_id, purchase_mode)` uniqueness contract.

`buyer_set_wholesale_cart_item(...)` is the only browser-facing wholesale mutation authority. It re-resolves:

- verified Business buyer eligibility;
- Buyer/Business capability state;
- supplier Seller/Business verification and capability state;
- offer status/window;
- MOQ/increment validity;
- applicable tier price;
- live inventory and pending reservations.

The client never supplies an authoritative price.

## Cart hydration and explainable invalidation

`hydrateActiveCart(...)` recomputes wholesale availability and pricing from canonical server data.

If an existing wholesale line becomes invalid because an offer is paused, expires, becomes unavailable, or capability/verification state changes, the line remains explainable in the cart but becomes unavailable.

For an unavailable wholesale offer:

- `available = false`;
- `availabilityReason` identifies the safe generic reason;
- live `wholesaleTerms` are removed;
- unit price becomes zero;
- line total becomes zero;
- checkout is blocked.

This prevents stale B2B terms from remaining price-authoritative while preserving a recoverable user experience.

## Quote authority

`POST /api/cart/quote` hydrates the canonical cart and persists a server-side `cart_quotes` snapshot.

Wholesale quote lines capture:

- cart item/product/variant/Seller identity;
- quantity;
- purchase mode;
- wholesale offer identity;
- server-resolved wholesale terms;
- server-resolved unit price;
- line total;
- availability state.

The quote is not final payment authority. It is an auditable intermediate snapshot.

## Final checkout authority

M4A replaces the implementation of the existing `create_checkout_session_v2(...)` signature rather than introducing another checkout function.

Checkout executes transactionally and:

1. resolves the authenticated Buyer;
2. checks Buyer capability;
3. locks the active cart;
4. locks and validates the quote;
5. requires quote readiness, non-expiry and matching cart version;
6. re-resolves the live product and verified Seller;
7. locks the live variant;
8. for wholesale, re-verifies the Business buyer;
9. locks and re-validates the live wholesale offer/window;
10. re-verifies supplier Business capability/verification;
11. rechecks MOQ-relative quantity semantics;
12. recomputes the applicable live tier price;
13. rejects quote/live price drift with `cart_quote_price_changed`;
14. recomputes inventory availability against pending reservations;
15. creates the canonical payment session, order, order item and inventory reservation atomically;
16. consumes the quote only after all authority checks succeed.

A failed checkout must roll back its payment session/order/reservation and must not consume the idempotency key.

## Immutable order pricing evidence

Canonical `order_items` now preserve:

- `purchase_mode`;
- `wholesale_offer_id`;
- `pricing_snapshot`.

For wholesale, `pricing_snapshot` stores the authoritative values used at checkout:

- offer ID;
- applied tier minimum quantity;
- MOQ;
- order multiple;
- unit label;
- case-pack size;
- lead time;
- Incoterm;
- unit price in cents.

This snapshot is transaction evidence. Later offer edits must not rewrite historical order economics.

## Idempotency

`create_checkout_session_v2(...)` retains the canonical Buyer/idempotency-key contract.

The same idempotency key for the same cart/quote returns the same valid payment session. Reuse for a different cart/quote is rejected. A failed transaction must not strand the key in a partially created state.

## Inventory authority

Wholesale uses the existing canonical inventory reservation ledger.

At final checkout the variant is locked and pending, unexpired reservations are summed before creating the new reservation. Wholesale does not bypass the M2/M3 reservation protections.

## Fail-closed state transitions

The regression suite explicitly covers:

- offer future start window;
- offer pause;
- Seller capability suspension;
- supplier Business capability suspension;
- Business buyer verification loss;
- invalid tier edits;
- stale quote/live wholesale price drift;
- ordinary Buyer attempts to access B2B pricing or cart mutation;
- cross-BSM offer mutation;
- anonymous access.

Administrative suspension details are not intentionally leaked to purchasing users. Generic unavailable-state errors are preferred where detailed internal state is unnecessary.

## HTTP and page surfaces

Canonical M4A APIs:

- `GET/PUT /api/bsm/trading-roles`;
- `GET/POST /api/bsm/wholesale/offers`;
- `GET /api/bsm/wholesale/catalog`;
- `POST /api/cart/wholesale`;
- existing `/api/cart`, `/api/cart/quote`, `/api/checkout/session`.

Canonical M4A pages:

- `/dashboard/bsm`;
- `/dashboard/bsm/wholesale`;
- `/dashboard/bsm/marketplace`;
- existing `/cart` and checkout surfaces.

Page gating improves UX but is not the security boundary. API authorization, RPC checks and RLS remain authoritative.

## Accessibility and responsive requirements

M4A pages preserve the single global `main#main` landmark provided by the app shell and do not nest additional `<main>` elements.

Authenticated Chromium gates cover:

- anonymous redirect/no B2B leakage;
- ordinary Buyer no B2B leakage;
- Supplier BSM dashboard and offer manager;
- verified Business sourcing marketplace;
- MOQ/increment controls;
- minimum 44px quantity touch targets;
- cart rendering;
- horizontal overflow;
- browser console/page errors;
- WCAG A/AA axe rules.

## Security-definer governance

M4A privileged functions are included in the repository's SECURITY DEFINER regression surface. Browser-facing functions are granted only to `authenticated` and `service_role` as required. Trigger helpers are not executable by anonymous/authenticated browser roles.

Any new M4A privileged function must be added to the same structural/security regression gates before merge.

## Known non-security scaling follow-up

Wholesale catalogue text search currently filters the RLS-authorized hydrated result set after the API's bounded query. This avoids raw PostgREST filter construction from user input, but at very large catalogue scale it may miss matches outside the fetched window.

That should be replaced later with a database-backed, authorization-preserving search path. It is a relevance/scalability issue, not a reason to weaken RLS or expose raw B2B catalogue data.

## Non-goals for M4A

M4A does not include:

- a second payment provider stack;
- a wholesale-only identity system;
- public B2B pricing;
- permanent mutually exclusive Manufacturer/Supplier/Distributor/etc. account roles;
- live selling/social commerce;
- production provider activation that bypasses the existing payment/payout launch blockers.

## Source of truth

After merge, repository migrations, RLS/RPC definitions, regression tests and verified deployed behavior are authoritative. This document describes those contracts but does not override them.
