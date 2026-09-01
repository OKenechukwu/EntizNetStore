# EntizNetStore Payment Authority — Production Evidence

Date: **2026-09-01**

This record captures the production promotion and verification of PR #44, the payment-initialization authority hardening. It is evidence for P0-03/P0-07; it does **not** declare a real payment processor launch-ready.

## Release identity

- PR: `#44` — `security: serialize payment initialization authority`
- Exact green PR head: `6e0d6e9fd99d2b7ffb82dbc80d8d80efea0ceed2`
- Merge commit on `main`: `06eecb4642eedf56ace97708af3a82d0d5c000cd`
- Vercel production deployment: `dpl_GX6S7Fxd5YPVsan3rvcUmrFZTMBN`
- Vercel deployment source SHA: `06eecb4642eedf56ace97708af3a82d0d5c000cd`
- Vercel state/target at verification: `READY` / `production`

`main` remained at the PR's tested base while the final-head gates ran, so the merged release did not cross untested base drift.

## Exact-head verification before merge

All required PR-head workflows completed successfully:

- CI — application foundation, lint, storage recovery, upload-scanner fail-closed, launch indexing, operational-log redaction, canonical checkout client contract, TypeScript and production build;
- fresh Supabase migration reproduction and structural verification;
- P0 `SECURITY DEFINER` surface regression;
- provider-neutral payment regression;
- **8 independent PostgreSQL connections racing one payment-initialization claim** — exactly one winner required;
- terminal payment-state regression;
- payout ledger and payout concurrency regressions;
- Product Media Authority, including direct RPC/PostgREST provenance and cross-session races;
- Image Egress Security;
- authenticated HTTP/Chromium authorization and browser regression.

The exact final-head check contexts observed from GitHub were `verify`, `database-reproduction`, `dependency-audit`, `http-authorization`, `product-media-provenance`, and `image-egress`.

## Production migrations

The exact merged migration contents were applied through the Supabase migration mechanism, not ad-hoc DDL.

Production migration ledger entries:

- `20260901004748` — `p0_payment_initialization_authority`
- `20260901004804` — `p0_payment_provider_reference_index_canonicalization`

The second migration removes the older duplicate provider-reference unique index only after the canonical replacement is present.

## Production database proof

Read-only post-promotion verification proved:

- `payment_sessions.payment_initialization_attempt_id uuid` exists;
- `payment_sessions.payment_initialization_started_at timestamptz` exists;
- `payment_sessions_initialization_attempt_check` exists;
- `idx_payment_sessions_initialization_attempt` is a unique partial index;
- `idx_payment_sessions_provider_reference_unique` is the sole canonical provider/reference unique index;
- historical duplicate `idx_payment_sessions_provider_payment` is absent;
- `payment_sessions` RLS remains enabled;
- **49/49 public tables have RLS enabled**.

Function authority after promotion:

| Function | anon | authenticated | service_role | Security |
| --- | ---: | ---: | ---: | --- |
| `attach_checkout_payment_reference(uuid,text,text)` | no | no | no | retired/non-executable |
| `attach_checkout_payment_intent(uuid,text)` | no | no | no | retired/non-executable |
| `service_claim_checkout_payment_initialization(uuid,uuid,uuid)` | no | no | yes | `SECURITY DEFINER`, locked search path, row lock |
| `service_attach_checkout_payment_reference(uuid,uuid,uuid,text,text)` | no | no | yes | `SECURITY DEFINER`, locked search path, row lock |
| `service_mark_checkout_payment_initialization_uncertain(uuid,uuid,uuid)` | no | no | yes | `SECURITY DEFINER`, locked search path, row lock |
| `cancel_checkout_session(uuid)` | no | yes | yes | self-scoped and refuses cancellation after an initialization claim |

The production cancellation function definition contains the required `payment_initialization_attempt_id is null` guard.

At the promotion verification point, production contained:

- `0` payment sessions;
- `0` sessions with provider references;
- `0` claimed initialization attempts;
- `0` uncertain initialization attempts.

Therefore the schema/privilege promotion changed no customer payment state.

## Production runtime proof

Canonical production health returned HTTP 200:

- service: `entiznetstore`
- database: `ok`
- storage: `ok`
- operations: `ok`
- version: `06eecb4642ee`

Launch interlocks remained intentionally closed:

- upload safety: `blocked`
- indexing: `blocked`

Vercel post-release inspection found:

- no grouped runtime errors in the verification window;
- no `error` or `fatal` runtime logs for deployment `dpl_GX6S7Fxd5YPVsan3rvcUmrFZTMBN` in the verification window.

## Security-advisor review

The post-DDL Supabase security advisor did not report the new service-only payment functions as browser-executable. Existing WARN findings for authenticated `SECURITY DEFINER` functions correspond to the intentionally reviewed Buyer/Seller/Business RPC surface frozen by `scripts/test-security-definer-surface.sql` and scoped to `auth.uid()`. Existing `RLS Enabled No Policy` INFO items are deny-by-default/private ledger surfaces and were not introduced by PR #44.

Reference remediation documentation for the generic advisor findings: https://supabase.com/docs/guides/database/database-linter

## What PR #44 now guarantees

1. An external payment initialization must be claimed durably before the processor call.
2. Concurrent initialization attempts serialize on the canonical checkout; only one attempt can win.
3. The same server-generated attempt ID is part of the provider adapter contract for provider-native idempotency.
4. Browser roles cannot stamp provider payment references.
5. Provider/reference identity is unique across local checkout sessions.
6. Ambiguous processor/network outcomes never automatically cancel the order, release inventory, clear the claim, or authorize a retry.
7. Buyer cancellation cannot release inventory after external payment initialization has been claimed.
8. Verified provider callbacks remain the authority for money-state finalization.

## Remaining external launch gate

Production payment processing intentionally remains `unconfigured`. P0-03 is **not complete** until an approved processor/legal entity is selected and its adapter passes deployed sandbox/live-mode controls, signed webhook replay/out-of-order tests, refund requirements, provider reconciliation and money-movement alerting.

The next internal hardening step is a durable stale-claim/reconciliation detector so a crash after the claim cannot become a silent operational condition.
