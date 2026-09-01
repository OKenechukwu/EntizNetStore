# EntizNetStore Production Incident Response

Last reviewed: **2026-09-01**

This runbook governs production incidents for EntizNetStore. It covers the marketplace web runtime, Supabase database/auth/storage, Seller/Admin operations, checkout/payment/refund state, payout/escrow state, and EntizNet integration boundaries.

`LAUNCH_BLOCKERS.md` remains the launch-readiness authority. This runbook defines response behavior; it does not claim that every external provider or alert destination is already production-ready.

## Ownership and acknowledgement

The EntizNetStore engineering/operations owner is responsible for acknowledging production incidents, assigning an active responder, preserving evidence, and coordinating recovery. Money movement, identity/KYC, authorization, or suspected data exposure incidents must be treated as security-sensitive until disproved.

The scheduled GitHub `Production Monitor` workflow runs the canonical production HTTP smoke check every 15 minutes. A failed check opens or updates a repository incident issue; a later successful check records recovery and closes the monitor issue. GitHub monitoring is one detection source, not the only source.

## Severity

### SEV-1 — critical

Examples:

- suspected unauthorized access, privilege escalation, or customer/KYC data exposure;
- payment, refund, payout, escrow, or inventory state can be duplicated, lost, or corrupted;
- production database unavailable with no safe customer transaction path;
- EntizNet integration accepts invalid/replayed identity or Admin assertions;
- broad authentication failure or inability to enforce suspension/authorization.

Response objective: acknowledge immediately, contain first, and stop unsafe writes or traffic paths when necessary.

### SEV-2 — major degradation

Examples:

- checkout, uploads, KYC, messaging, Seller operations, or Admin operations materially failing for a meaningful subset of users;
- payment/payout provider callbacks delayed while internal state remains safe;
- repeated elevated 5xx/runtime errors without evidence of corruption or unauthorized access;
- EntizNet handoff/Admin service unavailable but standalone Store remains safe.

Response objective: assign an active responder quickly, contain the affected flow, and restore safely.

### SEV-3 — limited impact

Examples:

- isolated non-critical route degradation;
- delayed non-transactional notifications;
- localized UI/runtime defect with safe recovery and no authorization, identity, or money impact.

Response objective: track, mitigate, and fix without bypassing normal release controls.

## First-response checklist

For SEV-1/SEV-2 incidents:

1. Record the detection time, affected route/flow, exact production deployment ID and Git commit SHA.
2. Capture sanitized request IDs, provider event IDs, database transaction/order/payment/payout identifiers, and relevant timestamps. Do not copy secrets or full sensitive payloads into GitHub issues or chat.
3. Check `GET /api/health`, Vercel grouped runtime errors/logs, Supabase health, and the affected domain-specific ledger/state.
4. Determine whether writes are safe. If authorization, money movement, inventory reservation, KYC privacy, or reconciliation is uncertain, stop or fail closed on the affected path rather than allowing uncertain writes.
5. Preserve database state and audit evidence. Never rewrite or delete an applied migration to recover an incident.
6. If an application rollback is required, only roll back to a `READY` deployment known to be compatible with the already-applied database schema.
7. Confirm recovery through the canonical production URL and the relevant regression/smoke checks before declaring the incident resolved.

## Domain playbooks

### Authentication, Admin, and EntizNet integration

- Confirm unauthenticated and unauthorized routes remain fail closed.
- Verify Store-local suspension still takes precedence where applicable.
- For EntizNet assertions, validate issuer/audience/purpose/time/key ID/replay behavior before re-enabling a failing integration path.
- Rotate a signing or privileged credential only through the documented secret-management process; never put replacement values in repository files, issues, logs, or browser/mobile configuration.
- If privilege escalation or assertion leakage is suspected, treat as SEV-1 and revoke/rotate affected credentials before restoring trust.

### Checkout, payment, refund, and inventory

- Stop new payment initialization if order/payment state cannot be reconciled safely.
- Preserve idempotency keys, provider event IDs, order IDs, inventory reservations, and refund records.
- Do not manually mark a payment successful solely from a client report or UI state.
- Reconcile internal terminal state against the selected provider before replaying callbacks or issuing compensation.
- Duplicate, delayed, or out-of-order webhooks must remain idempotent.

#### Payment initialization reconciliation alert

`/api/health` exposes only a bounded `checks.payments` status. It never exposes affected checkout IDs, Buyer IDs, attempt IDs, provider references, or counts. `payments=degraded` means trusted server reconciliation is required because at least one active checkout has either:

- an explicit `payment_initialization_uncertain=true` marker; or
- a durable initialization claim that remains unbound to any provider reference beyond the 10-minute grace window.

A provider-bound `requires_payment` checkout that is legitimately waiting for customer action does not trigger this detector. Paid, failed and cancelled terminal sessions do not trigger it either.

When `checks.payments=degraded`:

1. Treat the affected payment path as reconciliation-locked. Do **not** clear `payment_initialization_attempt_id`, issue another processor-create call, cancel/release inventory through a browser workaround, or manually stamp a provider reference.
2. Locate the affected records through trusted server/database operations only. Keep payment-session, Buyer, provider and attempt identifiers out of public health output and normal incident issues.
3. Use the exact server-generated initialization attempt/idempotency key to query the selected provider through its authenticated server-side API or dashboard. Determine whether the external create operation definitely succeeded, definitely did not occur, or remains ambiguous.
4. If the provider object exists and its identity is verified, bind it only through the exact owning service authority (`service_attach_checkout_payment_reference`) using the matching checkout, Buyer and initialization-attempt identity. Then allow signed/verified provider callbacks and the canonical payment state machine to finalize money state.
5. If the provider proves that no external side effect occurred, do not repair the checkout by direct SQL or by clearing the claim ad hoc. Use a reviewed, audited recovery procedure/forward change that preserves the original attempt evidence before allowing a replacement attempt.
6. If the provider charged successfully after the Store inventory reservation expired or inventory can no longer be fulfilled safely, do not oversell or force-consume unavailable stock. Preserve evidence and follow the approved refund/compensation procedure.
7. Keep the incident open until the source payment records are reconciled and `checks.payments` returns `ok` through the canonical production smoke path.

The payment reconciliation health RPC returns diagnostic counts only to `service_role`; those counts are for trusted operations and must not be proxied to browsers or copied into public telemetry with record identifiers.

### Seller payout and escrow

- Pause new disbursements if payout terminal state or escrow ownership is uncertain.
- Never release the same escrow claim to two payout attempts.
- Reconcile provider-side payout IDs/idempotency keys with the internal payout ledger before retrying.
- Failed/cancelled payout compensation must preserve auditable ledger history.

### KYC, uploads, and storage

- Treat unexpected public access to KYC/message attachments as SEV-1.
- Confirm bucket privacy/public boundaries and object ownership before restoring uploads/downloads.
- For partial storage/database failures, inspect compensation logs and reconcile orphaned objects without weakening ownership validation.
- Do not bypass magic-byte/type/size validation to restore service.
- Malware/content scanning policy remains a launch requirement; when a scanning provider is introduced, scanning failures must fail according to the documented risk policy rather than silently accepting unsafe files.

### Database and readiness

- `/api/health` returning 503 means at least one production readiness boundary is degraded. Inspect the bounded `checks` statuses first: database, storage, operations and payments. Do not assume every 503 is a database outage.
- Preserve a recovery checkpoint before corrective schema work.
- Apply schema corrections only through new forward migrations.
- Verify RLS, function privileges, and affected commerce/security regressions after any emergency database change.

## Evidence and redaction rules

Never place any of the following in GitHub issues, normal application logs, screenshots, support messages, or incident chat:

- Supabase service-role credentials or database passwords;
- EntizNet/Store private signing keys or complete signed assertions/tokens;
- session/access/refresh tokens;
- signed upload/download URLs or storage upload tokens;
- payment/payout provider secret keys, webhook secrets, or raw sensitive provider payloads;
- complete KYC documents, bank statements, identity numbers, or unnecessary customer PII.

Prefer bounded metadata: error class, sanitized error message, route, request ID, internal record UUID, provider event ID, status code, deployment SHA, and timestamp. Redact query strings or headers when they can contain secrets.

## Recovery gate

An incident is not resolved merely because a route returns 200 again. Before closure, verify the affected invariant:

- authorization/ownership isolation still holds;
- database and storage state are reconciled;
- payment/refund/payout state is internally and externally consistent where an external provider is involved;
- `/api/health` is healthy when a readiness boundary was affected;
- canonical production smoke checks pass;
- grouped runtime errors are understood or absent for the recovery window;
- no temporary bypass, debug route, weakened RLS, exposed secret, or cleared reconciliation evidence remains.

## Post-incident review

For every SEV-1 and meaningful SEV-2 incident, record:

- customer/business impact and exact duration;
- root cause and contributing conditions;
- what detected the incident and whether detection was timely;
- containment/recovery actions and exact release/database identities;
- whether data, inventory, orders, money, KYC, or integration state requires reconciliation;
- permanent prevention work, tests/alerts added, owner, and target milestone.

Update `LAUNCH_BLOCKERS.md`, architecture/operations documentation, and regression coverage whenever the incident reveals a launch-readiness gap.
