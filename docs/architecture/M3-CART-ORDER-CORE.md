# M3 — Trusted Commerce Foundation (supporting work)

Status: **ACTIVE SUPPORTING WORK FOR COMBINED M3**

Canonical milestone: `M3-MARKETPLACE-OPERATIONS-ENTIZNET-INTEGRATION.md`

## Purpose

This work began before the combined M3 scope was locked. It is retained because persistent carts, trusted addresses, server-authoritative quotes, checkout snapshots, reservations and order state are prerequisites for the combined M3 operational surfaces covering orders, refunds, disputes, escrow, payouts, revenue and transaction search.

It is not a separate roadmap milestone.

## Supporting scope

- persistent Buyer carts/cart items;
- one active cart per Buyer;
- canonical live product/variant availability and pricing;
- safe import from the legacy anonymous localStorage cart;
- Buyer-owned saved addresses behind trusted RPC/API mutation;
- versioned immutable quote snapshots;
- fail-closed shipping/tax quote behavior until providers are configured;
- trusted cart + quote + address -> checkout/order snapshot boundary;
- payment initialization from an internal checkout session only;
- reuse of existing inventory reservation, order, payment, escrow and payout state machines;
- database/HTTP authorization regressions.

## Security outcome

Normal browser clients must not be able to manufacture arbitrary checkout item arrays, prices, totals, addresses, order state, reservation state or payment state. Those values must flow from trusted server-owned marketplace records.

## Deployment discipline

The high-frequency development branch disables its own Vercel auto-deploys so GitHub CI can absorb rapid engineering commits without exhausting the Vercel Hobby deployment quota. `main` remains production-enabled.
