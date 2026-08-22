# ADR-0003 — Seller payout provider boundary

Status: **Accepted**  
Date: **2026-08-22**

## Context

EntizNetStore must complete its seller-money state machine before the final external payment/payout processor is selected. Processor underwriting and the contracting legal entity are intentionally deferred until pre-launch, but that must not leave escrow ownership, payout idempotency, retries, or reconciliation coupled to a future provider SDK.

A seller payout is especially sensitive to ambiguous network failures: a provider can accept a transfer while the application times out before receiving the provider reference. Releasing the same escrow balance after such an error could fund a second transfer.

## Decision

EntizNetStore owns a provider-neutral payout ledger. External payout processors are adapters only.

The canonical internal contract is:

1. A trusted server authenticates the seller and calculates the release-policy cutoff.
2. `request_seller_payout` atomically locks and claims eligible escrow rows into one idempotent payout request.
3. Claimed escrow remains `held`; payout items are `reserved`. Creating a payout request never means money has left the marketplace.
4. A provider adapter initializes the external payout using the internal `payoutRequestId` as its provider-side idempotency reference.
5. The provider reference is attached only through a service-role RPC. Sellers cannot select their own seller ID, eligibility cutoff, provider reference, or outcome through the Data API.
6. Signed provider callbacks are normalized to one of `succeeded`, `retryable_failure`, `terminal_failure`, or `cancelled` before entering the ledger state machine.
7. Only a verified `succeeded` callback changes escrow from `held` to `released` and marks payout items `settled`.
8. Terminal failure/cancellation releases the payout **claim**, not the escrow money, so a later request can safely retry the same held balance.
9. Exact provider-event replay is deduplicated. Late failures cannot downgrade a succeeded payout. A late success after a terminal local state is a reconciliation incident and is rejected rather than silently mutating money state.

## Eligibility policy

The database enforces structural eligibility: the escrow belongs to the seller, remains held, has no dispute, and its order is paid, delivered, and fulfilled.

The business hold period is **not hard-coded in SQL**. The trusted server supplies an `eligible_before` cutoff derived from the production `PAYOUT_HOLD_DAYS` configuration. Enabling a real payout adapter without a valid hold-period configuration fails closed. This keeps the business-policy duration changeable without weakening database authorization.

## Concurrency and idempotency

- `payout_requests` is unique on `(seller_id, idempotency_key)`.
- Eligible escrow rows are locked with `FOR UPDATE ... SKIP LOCKED` before claims are created.
- A partial unique index allows each escrow transaction to have at most one active (`reserved` or `settled`) payout item.
- A failed/cancelled request keeps immutable historical payout items in `released` state rather than deleting them.
- CI runs both state-machine regression tests and two simultaneous database sessions competing for the same escrow row.

## Provider initialization failures

The application does **not** automatically release escrow reservations when external payout initialization fails or times out. The provider may already have accepted the transfer. The request remains pending/reserved for an idempotent retry or operator reconciliation.

An explicit service-role cancellation RPC exists for cases where an operator/provider confirms that no transfer can occur. It releases only the payout items; the underlying escrow remains held.

## Security boundary

- `payout_requests` and `payout_items` are RLS-protected; authenticated sellers have read-only access to their own rows.
- Raw `payout_provider_events` are not exposed to authenticated/anonymous users.
- Payout mutation/finalization RPCs are `SECURITY DEFINER` only because they coordinate multiple RLS-protected money tables; `EXECUTE` is revoked from `PUBLIC`, `anon`, and `authenticated` and granted only to `service_role`.
- Every privileged payout RPC uses a fixed `search_path`.
- Payout destination configuration remains in `profiles_seller_private` and is passed only to server-side adapters. It must never be returned by payout APIs or logged.

## Unconfigured launch posture

`PAYOUT_PROVIDER=unconfigured` is a first-class fail-closed state. The public request and webhook routes do not create external payouts, and there is no production-accessible fake payout endpoint.

A real provider may be enabled only after:

- legal/underwriting approval;
- sandbox adapter implementation;
- destination/account onboarding verification;
- signed webhook verification;
- provider idempotency/retry testing;
- reconciliation and incident procedures;
- an explicitly approved `PAYOUT_HOLD_DAYS` business policy.

## Consequences

The external provider can change without rewriting escrow or seller-order logic. Internal payout correctness can be exhaustively tested now, while actual disbursement remains a hard pre-launch gate.
