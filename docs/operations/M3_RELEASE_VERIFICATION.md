# M3 Release Verification — Marketplace Operations, Admin & EntizNet Integration

**Status:** ENGINEERING + LIVE DATABASE + PRODUCTION DEPLOYMENTS VERIFIED; PRODUCTION SIGNING KEYS + REAL CROSS-PRODUCT E2E PENDING  
**Verified:** 2026-08-24

## Scope

This record captures release evidence for M3 marketplace operations, Admin control planes and EntizNet integration, including the post-M3 hardening that removed direct EntizNet access to EntizNetStore Supabase privileged credentials.

This does not approve public launch. `LAUNCH_BLOCKERS.md` remains authoritative for backups, production processors/payouts, observability, deployment operations, integration E2E, mobile, accessibility and policy readiness.

## Original M3 CI evidence

EntizNetStore CI #333, run `32680825079`, passed exact code head `1ea6918176f09e689588ead0d8bd71d978b48267`.

The release stack covered production-foundation verification, TypeScript, production Next.js build, dependency audit, clean Supabase/PostgreSQL 17 replay, M2/M3 structural invariants, M1/M2/M3 regressions, P0 commerce/authorization, provider-neutral/terminal payment state, payout ledger and real concurrent payout escrow claiming.

## Original M3 production database rollout

Canonical production project: `kllwwurklumhawfsilpd`.

Fourteen forward M3 migrations were applied. Final M3 advisor hardening is recorded live as `20260824014924_m3_advisor_hardening`.

Postflight:

- public tables: 45;
- RLS-enabled public tables: 45;
- RLS-disabled public tables: 0;
- all eleven reported M3 unindexed foreign keys fixed;
- catalogue RLS uses the non-exposed `app_private.marketplace_capability_is_active` helper;
- generic public capability helper is browser-denied and service-role available;
- critical execute grants/search paths and capability/catalogue triggers verified;
- production seeded data preserved.

Repository filename timestamps and Supabase management-recorded timestamps can differ for applied migrations. Applied SQL remains immutable; release procedure must reconcile by migration identity/content rather than rewriting history.

## Original M3 web rollout

- Store main M3 merge: `6a3220ddbc97d81cd30ab805ae20d75bf3e42f98`.
- Store production deployment: `dpl_38NY6erWQAwmn3zN6ckZWxN46zfZ`, READY.
- Paired EntizNet issuer engineering was delivered through PR #29 and the canonical handoff contract.

## Post-M3 Admin integration hardening

### Why it was required

Legacy EntizNet Admin tooling still contained a direct EntizNetStore Supabase bridge. That would have required EntizNet to possess EntizNetStore's service-role credential, violating the intended product/security boundary.

The bridge has been removed. EntizNet now calls narrow EntizNetStore application APIs using short-lived Ed25519-signed, scope-restricted Admin assertions.

### Store receiver CI

Store PR #10 — `Harden EntizNet Admin integration boundary`:

- exact tested head: `848f23efb181be84a65fc19b079d7fd12ec24286`;
- CI #339 / run `32710050313`: SUCCESS;
- production foundation: success;
- TypeScript: success;
- production build: success;
- production dependency audit: success;
- fresh Supabase reset/replay: success;
- Admin service boundary replay/privilege regression: success;
- every existing M1/M2/M3/payment/payout/concurrency suite: success.

### Store receiver database rollout

Forward migration:

- repository file: `supabase/migrations/20260824171000_entiznet_admin_service_boundary.sql`;
- Supabase management-recorded live migration: `20260824131414_entiznet_admin_service_boundary`.

The migration adds no public table. `app_private.entiznet_admin_api_requests` stores replay/audit state for verified external EntizNet Admin requests.

Live verification after migration:

- public tables: 45;
- public RLS tables: 45;
- `app_private.entiznet_admin_api_requests`: present;
- public ledger equivalent: absent;
- anon/authenticated ledger SELECT: denied;
- service-role ledger SELECT: allowed;
- anon/authenticated execute on register/complete/account-search integration RPCs: denied;
- service-role execute on all three: allowed;
- initial request rows: zero.

### Store receiver merge/deployment

- PR #10 merge commit: `e216ba9918dd2a50659aab595477fc39cef494fb`;
- Vercel production deployment: `dpl_8jAjnm8PNTQudvxQfSmmAFPM3ACa`;
- deployment source: exact merge commit above;
- deployment state: READY;
- canonical `https://entiznetstore.vercel.app/`: HTTP 200;
- unsigned `/api/integrations/entiznet/admin/health`: HTTP 401 `missing_admin_assertion`;
- unsigned `/api/integrations/entiznet/admin/accounts`: HTTP 401 `missing_admin_assertion`;
- runtime-error groups on these routes in verification window: zero.

### EntizNet sender CI

EntizNet PR #30 — `Replace direct Store database access with signed integration API`:

- exact tested head: `98a1294dd3e99c01eea875f3a13610194e05cf62`;
- EntizNet CI #125 / run `32710100051`: SUCCESS;
- direct EntizNetStore database-credential rejection gate: success;
- production Next.js build: success.

The PR removed `storeAdmin()` and the application dependency on the legacy Store Supabase URL/service-role environment variables. The CI guard now prevents those credential names from being reintroduced into EntizNet application code.

### EntizNet sender merge/deployment

- PR #30 merge commit: `29c505cd0bb1be56a912e0a2228a96a1bf3d8743`;
- Vercel production deployment: `dpl_GU5PWyAtgMQ72kubt8JbuA18Gkhc`;
- deployment source: exact merge commit above;
- deployment state: READY;
- canonical root: expected 307 age-check redirect;
- unauthenticated `/api/admin/store/ping`: HTTP 401 `Not authenticated`;
- unauthenticated `/api/admin/store/list-users`: HTTP 401 `Not authenticated`;
- runtime-error groups on these routes in verification window: zero.

## Security contract after hardening

EntizNet does not require and must not receive EntizNetStore's Supabase service-role key.

User handoff and Admin API assertions use strict cryptographic domain separation even if one Ed25519 key family is used:

- user handoff audience: `entiznetstore`;
- Admin API audience: `entiznetstore-admin-api`;
- Admin assertion mandatory purpose: `admin-api`;
- Admin scopes currently: `store.health`, `store.accounts.read`;
- one-time `jti` replay protection;
- Admin sender TTL 60 seconds;
- no Store Admin auth-user spoofing.

The Admin API receiver records external EntizNet actor identity in its private integration ledger rather than inserting that UUID into Store `admin_audit_logs.admin_id`, which correctly references Store auth users.

## Exact production signing-key contract

EntizNet:

- `ENTIZNETSTORE_HANDOFF_PRIVATE_KEY`
- `ENTIZNETSTORE_HANDOFF_KEY_ID`
- `ENTIZNETSTORE_HANDOFF_ISSUER`
- `ENTIZNETSTORE_HANDOFF_AUDIENCE`
- `ENTIZNETSTORE_ADMIN_API_AUDIENCE`
- `ENTIZNETSTORE_ORIGIN`

EntizNetStore:

- `ENTIZNET_HANDOFF_PUBLIC_KEY`
- `ENTIZNET_HANDOFF_KEY_ID`
- `ENTIZNET_HANDOFF_ISSUER`
- `ENTIZNET_HANDOFF_AUDIENCE`
- `ENTIZNET_ADMIN_API_AUDIENCE`

## Remaining P0-08 verification

Production code, database and deployments are verified. The integration is not called fully E2E verified until server-side production signing configuration is provisioned and tests prove:

- real confirmed EntizNet user handoff;
- same-account linking/no duplicate identity;
- Buyer/Seller/Business consistency;
- local suspension precedence;
- replay rejection;
- safe return path;
- logout, revocation and re-entry;
- real signed EntizNet Admin health/account calls;
- operational visibility with no assertion/token leakage.

The broader public-launch blockers remain authoritative in `LAUNCH_BLOCKERS.md`.
