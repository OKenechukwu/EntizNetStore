# EntizNetStore Payment Initialization Authority

Last reviewed: **2026-09-01**

This document defines the trust boundary for creating an external payment object for an EntizNetStore checkout. It is launch-critical because a processor request is a money-movement operation: duplicate initialization, unsafe retry, or local cancellation after an ambiguous processor response can produce duplicate charges, orphaned payments, inventory inconsistencies, or orders whose local state disagrees with the processor.

## Authority model

The canonical flow is deliberately split:

1. **Buyer authentication and RLS choose the checkout.** `/api/payments/create-intent` authenticates the user with the normal server Supabase session and reads only the Buyer's visible `payment_sessions` row.
2. **Trusted service authority claims external initialization.** Before any processor network call, the server-only Supabase admin client invokes `service_claim_checkout_payment_initialization(session_id, buyer_id, attempt_id)`.
3. **The claim is durable.** PostgreSQL stores a unique `payment_initialization_attempt_id` plus `payment_initialization_started_at`. A different attempt cannot replace it automatically.
4. **The provider receives the same attempt ID as its idempotency key.** Every real provider adapter must use `PaymentInitializationInput.initializationAttemptId` through the processor's native idempotency mechanism.
5. **Only trusted service authority can bind the provider identity.** `service_attach_checkout_payment_reference(...)` validates the exact session, Buyer and attempt before persisting provider/reference metadata.
6. **Only verified provider callbacks finalize money state.** `finalize_checkout_payment_v2(...)` remains service-only and validates the stored provider/reference pair before changing orders, reservations, inventory or escrow.

Browser roles cannot claim payment initialization, bind provider references, mark reconciliation uncertainty, or invoke the payment finalizer.

## Why the claim occurs before the processor call

A simple `SELECT` followed by a provider request is not concurrency-safe. Two HTTP requests can both observe an uninitialized checkout and both create provider payment objects before either request writes a local reference.

The claim RPC locks the canonical payment-session row and persists one attempt ID before the server calls the processor. Concurrent requests serialize on that row; exactly one attempt wins. The CI regression `scripts/test-payment-initialization-concurrency.sh` exercises this with independent database connections.

The claim also verifies:

- session belongs to the expected Buyer;
- Buyer capability is active;
- checkout is still payable;
- no provider reference is already present;
- linked orders remain pending and belong to the same Buyer;
- a pending reservation exists;
- no reservation has expired or changed state.

## Provider-reference invariants

`service_attach_checkout_payment_reference(...)` is service-only and tied to the exact durable attempt ID. It rejects:

- wrong Buyer;
- wrong or missing attempt;
- terminal/non-payable checkout;
- conflicting existing provider/reference state;
- non-pending linked orders;
- a provider/reference pair already bound to another checkout.

A unique partial index on `(payment_provider, provider_payment_id)` gives the provider payment identity one authoritative local checkout.

The historical browser-callable `attach_checkout_payment_reference(uuid,text,text)` and the old Stripe-specific wrapper remain only for migration-history provenance and have no API-role execution grant.

## Ambiguous processor outcomes: never auto-retry

Once the external processor request starts, a timeout, connection reset, worker crash, or lost response is **ambiguous**. The provider may have accepted the request even if EntizNetStore never received the provider payment ID.

Therefore the application must never assume that a failed HTTP response means no provider object exists.

On any error after the durable claim:

- do **not** clear or replace the attempt ID;
- do **not** release inventory automatically;
- do **not** cancel the local order automatically;
- do **not** issue a second processor initialization automatically;
- mark the session with `service_mark_checkout_payment_initialization_uncertain(...)` when no provider reference is already stored;
- emit a critical, redacted operational event;
- return `PAYMENT_INITIALIZATION_UNCERTAIN` to the caller.

Buyer cancellation is also blocked once an initialization claim exists, so a browser cannot release inventory underneath an in-flight or ambiguous processor operation.

## Reconciliation procedure

An uncertain session requires trusted investigation before any recovery action.

1. Identify the local checkout by session ID and `payment_initialization_attempt_id`.
2. Check the processor using its trusted server/API tooling and the same provider-native idempotency key.
3. If the provider confirms a payment object exists:
   - verify amount, currency, Buyer/customer context and local checkout identity;
   - bind the verified provider reference using trusted service tooling tied to the existing attempt;
   - allow the verified webhook/finalizer path to move money/order state.
4. If the provider definitively proves no payment object exists:
   - document the evidence;
   - use an explicitly reviewed trusted recovery action to retire/cancel the attempt before allowing another initialization.
5. If the provider cannot establish either condition, keep the checkout reconciliation-locked and escalate operationally.

There is intentionally no public or automatic "clear stale attempt" API. Time elapsed is not proof that the provider did not create a payment.

## Processor onboarding gate

A payment provider is not production-ready merely because its SDK can create a payment. Before setting `PAYMENT_PROVIDER` to a real processor, verify all of the following:

- the provider legally supports the EntizNetStore marketplace model and operating entity;
- `initializePayment` uses `initializationAttemptId` as the provider-native idempotency key;
- amount/currency come only from the authoritative frozen checkout, never client input;
- provider metadata includes a non-secret local checkout correlation identifier where appropriate;
- webhook signatures are verified before parsing trusted money state;
- webhook events are replay-safe and idempotent;
- provider/reference mismatch fails closed;
- retryable, terminal, cancelled, succeeded and out-of-order events have regression coverage;
- ambiguous initialization has an operational reconciliation path;
- secrets exist only in server environments and are rotated/tested;
- live-mode low-value end-to-end payment, refund and payout/escrow behavior is verified before public launch.

Until those gates are satisfied, `PAYMENT_PROVIDER=unconfigured` is the intentional production-safe state.

## Regression evidence

The following gates protect this boundary:

- `scripts/test-security-definer-surface.sql` — freezes the reviewed browser `SECURITY DEFINER` surface and verifies payment initialization RPCs are service-only.
- `scripts/test-payment-provider-abstraction.sql` — verifies claim, reference binding, provider finalization, replay protection, terminal handling, reconciliation locking and Buyer cancellation denial.
- `scripts/test-payment-initialization-concurrency.sh` — races eight independent database connections and requires exactly one initialization-claim winner.
- `scripts/test-payment-terminal-state.sql` — verifies late/out-of-order events cannot resurrect terminal sessions.
- `.github/workflows/ci.yml` — runs all of the above against a fresh database reproduced from repository migrations.

## Logging and data handling

Payment operational logs must not contain:

- service-role keys or processor secrets;
- full provider payloads;
- card/payment credentials;
- customer payment data;
- raw signed webhook bodies;
- provider payment IDs unless an incident-specific secure channel explicitly requires them.

Normal operational events should correlate with the local session/record ID and stable event name while keeping external payment identifiers out of routine logs.
