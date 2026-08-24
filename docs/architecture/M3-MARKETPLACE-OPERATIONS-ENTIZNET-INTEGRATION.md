# M3 — Marketplace Operations, Admin & EntizNet Integration

**Schedule:** September 5–14, 2026  
**Status:** ENGINEERING + DATABASE + CI + PRODUCTION DEPLOYMENTS VERIFIED; PRODUCTION SIGNING KEYS + REAL CROSS-PRODUCT E2E PENDING  
**Last verified:** 2026-08-24

## Objective

M3 delivers the operational control plane and the secure EntizNet integration boundary required for EntizNetStore to operate both as a standalone marketplace and as a capability reached through EntizNet.

The milestone deliberately keeps product boundaries clean:

- EntizNet is canonical for EntizNet identity and additive Store capability grants.
- EntizNetStore is canonical for Store commerce data, Store KYC, Store-local suspension and marketplace operations.
- EntizNetStore remains a distinct repository, deployment and Supabase project.
- Buyer, Seller and Business capabilities are additive; no integration path may collapse them into a permanent single-role model.

## Marketplace operations delivered

M3 provides trusted operational surfaces and server-authoritative APIs/RPCs for:

- persistent Buyer cart, address, quote and checkout state;
- account/capability management;
- Seller/Buyer suspension and restoration;
- KYC operations;
- product moderation and catalogue governance;
- orders, refunds and disputes;
- escrow, payouts and financial search/summary;
- reviews, reports and prohibited-product enforcement;
- marketplace content and notifications;
- operational dashboards and audit trails.

Browser-side direct mutation of protected operational tables remains prohibited where trusted API/RPC boundaries are required.

## EntizNet user identity handoff

EntizNet user entry uses a short-lived Ed25519-signed assertion rather than shared database credentials or editable client claims.

The handoff contract includes:

- confirmed EntizNet session identity;
- canonical active Store capabilities only: `entiznetstore_buyer`, `entiznetstore_seller`, `entiznetstore_business`;
- issuer, audience, subject, `kid`, issue/not-before/expiry claims;
- unique `jti` replay protection;
- signed safe relative Store return path;
- POST handoff so the assertion is not placed in URLs;
- explicit one-to-one EntizNet↔Store identity links;
- existing standalone Store account reuse only after trusted confirmed-email ownership proof;
- additive Buyer/Seller/Business materialization without deleting historical commerce data;
- Store-local suspension as an additional deny even when EntizNet grants a capability;
- Store session establishment only after successful assertion validation and replay reservation.

The Store handoff ledger and identity-control RPCs remain trusted-server/service-role boundaries.

## EntizNet Admin service boundary

A post-M3 hardening release removed the legacy EntizNet Admin → EntizNetStore direct Supabase bridge.

### Prohibited architecture

EntizNet must never hold or use EntizNetStore's:

- Supabase service-role key;
- privileged Store database client;
- direct `auth.admin` access;
- Store database URL for privileged cross-product operations.

EntizNet CI now fails if application code reintroduces the legacy Store Supabase service-role environment-variable names.

### Replacement architecture

EntizNet Admin operations call narrow EntizNetStore application APIs using domain-separated Ed25519 assertions:

- `purpose = "admin-api"`;
- audience `entiznetstore-admin-api`;
- explicit operation scopes (`store.health`, `store.accounts.read`);
- 60-second sender TTL, with receiver maximum of 120 seconds;
- one-time `jti`;
- verified EntizNet Admin UUID as external actor;
- no Store auth-user spoofing.

Store receiver routes:

- `/api/integrations/entiznet/admin/health`
- `/api/integrations/entiznet/admin/accounts`

The Admin request/replay ledger lives in non-exposed `app_private.entiznet_admin_api_requests`. It records the actual EntizNet actor UUID, scope, route, method, expiry, replay hash and outcome. It is intentionally separate from `admin_audit_logs.admin_id`, whose foreign key correctly represents Store-local Admin auth users.

The Store account endpoint returns the canonical Buyer/Seller/Business/link read model rather than raw Supabase Auth Admin objects.

## Cryptographic domain separation

The user handoff and Admin service API may share one Ed25519 key family, but they are not interchangeable assertions.

User handoff:

- EntizNet audience: `entiznetstore`
- Store verification audience: `entiznetstore`
- identity/capability-specific claims

Admin service API:

- EntizNet env: `ENTIZNETSTORE_ADMIN_API_AUDIENCE` (default `entiznetstore-admin-api`)
- Store env: `ENTIZNET_ADMIN_API_AUDIENCE` (default `entiznetstore-admin-api`)
- mandatory `purpose=admin-api`
- allow-listed scopes

A valid login handoff must therefore fail Admin API validation, and a valid Admin assertion must fail login-handoff validation.

## Production key contract

EntizNet stores only the private Ed25519 signing material:

- `ENTIZNETSTORE_HANDOFF_PRIVATE_KEY` — base64 DER PKCS8 Ed25519 private key
- `ENTIZNETSTORE_HANDOFF_KEY_ID` — normally `v1`
- `ENTIZNETSTORE_HANDOFF_ISSUER` — default `entiznet`
- `ENTIZNETSTORE_HANDOFF_AUDIENCE` — default `entiznetstore`
- `ENTIZNETSTORE_ADMIN_API_AUDIENCE` — default `entiznetstore-admin-api`
- `ENTIZNETSTORE_ORIGIN` — canonical Store HTTPS origin

EntizNetStore stores only the public verification material:

- `ENTIZNET_HANDOFF_PUBLIC_KEY` — base64 DER SPKI Ed25519 public key
- `ENTIZNET_HANDOFF_KEY_ID` — normally `v1`
- `ENTIZNET_HANDOFF_ISSUER` — default `entiznet`
- `ENTIZNET_HANDOFF_AUDIENCE` — default `entiznetstore`
- `ENTIZNET_ADMIN_API_AUDIENCE` — default `entiznetstore-admin-api`

Private signing material must never be stored in EntizNetStore, Git, logs, browser/mobile code or `NEXT_PUBLIC_*` variables.

## Verified production evidence — August 24, 2026

### Original M3 release

- EntizNetStore CI #333 / run `32680825079` passed exact implementation head `1ea6918176f09e689588ead0d8bd71d978b48267`.
- All fourteen M3 forward migrations are live on Supabase project `kllwwurklumhawfsilpd`.
- Production baseline remained 45 public tables / 45 RLS / zero RLS-disabled tables.
- M3 main merge: `6a3220ddbc97d81cd30ab805ae20d75bf3e42f98`.
- M3 production deployment: `dpl_38NY6erWQAwmn3zN6ckZWxN46zfZ`.

### Admin-boundary hardening

- Store PR #10 exact head `848f23efb181be84a65fc19b079d7fd12ec24286` passed CI #339 / run `32710050313`, including production build, dependency audit, fresh Supabase replay, the new Admin-boundary replay/privilege regression and every prior M1/M2/M3/payment/payout/concurrency suite.
- Forward migration repository file `20260824171000_entiznet_admin_service_boundary.sql` is live as management-recorded migration `20260824131414_entiznet_admin_service_boundary`.
- Live postflight remained 45 public tables / 45 RLS. The request ledger exists only in `app_private`; anon/authenticated cannot read it or execute its integration RPCs; service role retains required access.
- Store PR #10 merged at `e216ba9918dd2a50659aab595477fc39cef494fb`.
- Store production deployment `dpl_8jAjnm8PNTQudvxQfSmmAFPM3ACa` is READY from that exact merge. `https://entiznetstore.vercel.app/` returned HTTP 200; unsigned Admin integration requests returned HTTP 401 `missing_admin_assertion`; no runtime-error group was present on those routes.
- EntizNet PR #30 exact head `98a1294dd3e99c01eea875f3a13610194e05cf62` passed EntizNet CI #125 / run `32710100051`, including the permanent direct-Store-database-credential rejection gate and production build.
- EntizNet PR #30 merged at `29c505cd0bb1be56a912e0a2228a96a1bf3d8743`.
- EntizNet production deployment `dpl_GU5PWyAtgMQ72kubt8JbuA18Gkhc` is READY from that exact merge. The canonical root performs the expected age-check redirect; unauthenticated Store Admin routes return EntizNet-local HTTP 401; no runtime-error group was present on those routes.

## Remaining P0-08 gate

Production code/database/deployment rollout is verified, but real cross-product identity integration is not called complete until production signing configuration is provisioned and a real authenticated E2E proves:

1. confirmed EntizNet user → Store handoff;
2. same-account linking and no duplicate identity;
3. Buyer/Seller/Business capability consistency;
4. Store-local suspension precedence;
5. replay rejection;
6. safe return path;
7. logout, revocation and re-entry behavior;
8. real EntizNet Admin signed `store.health` and `store.accounts.read` calls;
9. request/audit visibility without token/assertion leakage.

## Exit gate

M3 operations/database/web deployment are verified. The combined EntizNet integration exit gate remains a pre-launch condition under `P0-08` until signing keys and real authenticated cross-product E2E are verified.
