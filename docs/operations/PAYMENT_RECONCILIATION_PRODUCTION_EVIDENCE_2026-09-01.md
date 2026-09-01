# EntizNetStore Payment Reconciliation — Production Evidence

Date: **2026-09-01**

This record captures production promotion and verification of PR #45, the stale/uncertain payment-initialization reconciliation readiness hardening. It is evidence for P0-03 and P0-07; it does **not** declare an external payment processor launch-ready.

## Release identity

- PR: `#45` — `Harden payment reconciliation readiness`
- Exact green PR head: `d181fa32e9580092e0d84b8d5b665688047f9963`
- Merge commit on `main`: `28a8f1efd1fafd88792e0c6c345874f1d5bb8701`
- Vercel production deployment: `dpl_9g4AMt82rVCFWcfkmtLxYTVr26WR`
- Vercel deployment source SHA: `28a8f1efd1fafd88792e0c6c345874f1d5bb8701`
- Vercel state/target at verification: `READY` / `production`

The PR was merged with an expected-head lock only after every exact-head workflow completed successfully and the additive database expansion had been verified against the still-running previous production application.

## Exact-head verification before merge

All required PR-head workflows completed successfully:

- CI `verify`;
- fresh Supabase `database-reproduction`;
- `dependency-audit`;
- authenticated HTTP/Chromium `http-authorization`;
- `product-media-provenance`;
- `image-egress`.

The fresh-database lane replayed every migration from zero, verified the hardened `SECURITY DEFINER` surface, passed the provider-neutral payment suite, passed the real 8-connection payment-initialization race, then passed the chained reconciliation regression before terminal-payment and payout-concurrency suites.

## Expand-before-code production migration

The application release depends on a new service-only reconciliation RPC. Production therefore used an expand-before-code sequence:

1. prove the exact PR head on a fresh database and browser/HTTP gates;
2. apply only the additive reconciliation migration while the previous production application remained live;
3. verify the new RPC/indexes/privileges and live reconciliation state;
4. merge the exact tested head;
5. verify Vercel promoted the exact merge SHA.

Production migration ledger entry:

- `20260901155315` — `p0_payment_reconciliation_health`

The migration adds no customer data and replaces no existing payment state-machine authority.

## Production database proof

Read-only post-expansion verification proved:

- `idx_payment_sessions_unbound_initialization_started` exists with a narrow active/unbound partial predicate;
- `idx_payment_sessions_uncertain_initialization_started` exists with a narrow active/uncertain partial predicate;
- `public.service_payment_reconciliation_health(integer)` exists;
- the RPC is `SECURITY DEFINER`;
- function `search_path` is fixed to `pg_catalog, public`;
- `anon` cannot execute it;
- `authenticated` cannot execute it;
- `service_role` can execute it.

Live production reconciliation at the verification point returned:

- status: `ok`;
- stale window: `10` minutes;
- stale unbound claims: `0`;
- explicit uncertain claims: `0`.

Production contained `0` payment sessions at the expansion checkpoint, so the migration changed no customer payment state.

## Readiness semantics

The server-only RPC may return diagnostic counts to the trusted application server. The public readiness endpoint intentionally exposes only bounded state:

- `checks.payments = ok|degraded|unavailable`.

It does not expose buyer IDs, checkout IDs, attempt IDs, provider references or reconciliation counts.

Explicit initialization uncertainty degrades readiness immediately. A claimed initialization with no provider reference degrades after the bounded 10-minute grace period. Provider-bound customer-action states and paid/failed/cancelled terminal sessions are excluded from this incident condition.

A degraded payment reconciliation state makes canonical readiness fail rather than allowing an ambiguous money-movement condition to remain green.

## Production runtime proof

Canonical `https://entiznetstore.vercel.app/api/health` returned HTTP 200 with:

- service: `entiznetstore`;
- database: `ok`;
- storage: `ok`;
- operations: `ok`;
- payments: `ok`;
- version: `28a8f1efd1fa`.

Launch interlocks remained intentionally closed:

- upload safety: `blocked`;
- indexing: `blocked`.

Vercel post-release inspection found:

- no grouped runtime errors in the verification window;
- no warning, error or fatal logs for deployment `dpl_9g4AMt82rVCFWcfkmtLxYTVr26WR` in the verification window.

## Security-advisor review

The post-DDL Supabase security advisor did not report the new reconciliation RPC as executable by signed-in/browser roles. Existing authenticated `SECURITY DEFINER` warnings correspond to the intentionally reviewed Buyer/Seller/Business RPC surface already frozen by the database security regression suite. Existing `RLS Enabled No Policy` INFO items are deny-by-default/private ledger surfaces and were not introduced by PR #45.

Generic Supabase linter remediation reference: https://supabase.com/docs/guides/database/database-linter

## Operational response contract

An unresolved payment initialization is not repaired by clearing the durable claim, manually stamping a provider reference or blindly repeating provider creation. Operators must reconcile against the original provider/idempotency/attempt identity. If the provider completed money movement after local inventory authority expired, compensation/refund is preferred over overselling or fabricating local success.

The existing 15-minute production monitor consumes canonical readiness and therefore treats reconciliation degradation as a production incident without needing a second public diagnostic endpoint.

## Remaining external launch gate

Production payment processing remains `unconfigured`. P0-03 still requires an approved processor/legal entity, production adapter activation, deployed sandbox initialization using provider-native idempotency, signed callback duplicate/retry/out-of-order proof, refund requirements, provider-specific reconciliation, settlement alerting and operator rehearsal.
