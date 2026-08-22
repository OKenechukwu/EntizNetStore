# Pre-M3 — Cart & Order Commerce Foundation

Status: **ACTIVE DEVELOPMENT**

> Historical note: this work was initially labeled M3 in the feature branch and PR. The canonical M3 milestone is **Marketplace Operations & Admin (September 5–11)**. This document now records the cart/order work as a prerequisite commerce foundation and must not be used as the M3 roadmap.

## Goal

Replace the legacy browser-only cart/checkout boundary with a persistent, server-authoritative Buyer commerce core while preserving the already-tested M0–M2 payment, reservation, order and payout state machines.

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

## Why this precedes canonical M3

Marketplace Operations & Admin needs trustworthy commerce records to operate against. Admin order search, refunds, disputes, escrow, payouts, revenue reporting, transaction search, audit trails and operational dashboards are only meaningful if carts, checkout snapshots, inventory reservations and order state are canonical first.

## Deliberate exclusions

This prerequisite does **not** activate a real payment or payout provider. Payment-provider onboarding, signed external webhook verification, refunds/reconciliation and real Seller disbursement remain independent launch gates and/or canonical M3 operational surfaces.

## Deployment discipline

The current feature branch disables automatic Vercel Git deployments for `codex/m3-cart-order-core`. GitHub CI is the development gate. `main` remains production-enabled so only release-worthy merges consume Vercel production builds. The branch name is retained as historical implementation metadata; it no longer defines the roadmap milestone.
