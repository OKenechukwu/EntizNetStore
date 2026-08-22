# ADR-0002 — Payment provider boundary

Status: **Accepted**  
Date: **2026-08-22**

## Context

EntizNetStore must finish its commerce engine before the final acquiring/payment processor is selected. Processor availability depends on the marketplace business model, the legal entity used for contracting, supported merchant countries, underwriting, fees and payout capabilities.

The application previously coupled checkout directly to Stripe PaymentIntents, Stripe Elements and Stripe webhook event names. That made a provider decision part of core marketplace logic and would force a risky rewrite if the launch processor changed.

## Decision

EntizNetStore owns the canonical commerce state machine:

- authenticated checkout and idempotency;
- server-side catalog pricing;
- inventory reservation/consumption/release;
- seller order splitting;
- payment-session state;
- replay-safe event processing;
- order payment confirmation;
- escrow creation and platform-fee accounting;
- seller fulfillment state.

External payment processors are adapters. A provider adapter is responsible only for:

1. creating/initializing a provider-side payment request for a canonical EntizNetStore checkout session;
2. returning a normalized next action (for example a hosted redirect);
3. authenticating/verifying provider callbacks/webhooks;
4. mapping provider events into the normalized outcomes `succeeded`, `retryable_failure`, `terminal_failure`, or `cancelled`.

The database stores canonical `payment_provider` and `provider_payment_id` values. Legacy Stripe identifiers/functions remain only as compatibility wrappers during migration; new application code must use provider-neutral RPCs.

## Pending-provider behavior

`PAYMENT_PROVIDER=unconfigured` is a valid, safe configuration during development. In this mode:

- the public checkout UI clearly reports that payment activation is pending;
- the payment initialization and webhook routes return a controlled 503 response;
- no external charge/payment request is attempted;
- no public simulation/test payment endpoint exists.

The commerce engine is verified in disposable CI using normalized simulated provider references/events at the database boundary. This exercises the same inventory/order/escrow state transitions a real adapter must trigger without exposing a production bypass.

## Launch gate

A real processor may be enabled only after:

- legal/entity and processor underwriting are approved;
- an adapter implements the provider contract;
- webhook/callback authentication is verified with real test deliveries;
- success, retryable failure, terminal failure, replay, out-of-order delivery and cancellation are exercised end-to-end;
- reconciliation/refund/payout procedures required for launch are documented;
- production and preview secrets are isolated correctly.

Processor selection remains a P0 launch gate but does not block continued marketplace engineering.
