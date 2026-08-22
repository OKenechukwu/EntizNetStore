# M3 — Cart & Order Core

Status: **ACTIVE DEVELOPMENT**

## Goal

M3 replaces the legacy browser-only cart/checkout boundary with a persistent, server-authoritative Buyer commerce core while preserving the already-tested M0–M2 payment, reservation, order and payout state machines.

Functional exit condition: **a signed-in Buyer can maintain a persistent cart across sessions/devices, manage trusted addresses, obtain a server-authoritative checkout quote, and freeze that cart into an immutable checkout/order snapshot with inventory reservation and valid order-state transitions—without accepting real money until the separate payment-provider launch gate is cleared.**

## Scope

- persistent Buyer carts and cart items;
- one active cart per Buyer;
- canonical product/variant availability and price hydration;
- safe migration from the legacy localStorage cart;
- Buyer-owned saved shipping/billing addresses;
- server-only address/cart mutation boundaries;
- quote/version model so any cart mutation invalidates an older quote;
- provider-neutral shipping/tax quote readiness with fail-closed behavior while external quote providers are unconfigured;
- immutable cart/item/address/totals snapshot at checkout;
- existing checkout idempotency and inventory-reservation reuse;
- existing buyer/seller order RLS and Seller fulfillment transition reuse;
- database and HTTP authorization regressions.

## Deliberate exclusions

M3 does **not** activate a real payment or payout provider. Payment-provider onboarding, signed external webhook verification, refunds/reconciliation and real Seller disbursement remain independent P0 launch gates. The first M3 release must be safe with payment processing still unconfigured.

## Deployment discipline

The M3 feature branch disables automatic Vercel Git deployments for `codex/m3-cart-order-core`. GitHub CI is the development gate. `main` remains production-enabled so only release-worthy merges consume Vercel production builds. This prevents high-frequency engineering commits from exhausting the Hobby deployment quota again.
