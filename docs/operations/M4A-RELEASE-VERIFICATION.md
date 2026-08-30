# M4A BSM Wholesale Marketplace — Release Verification

## Purpose

This runbook defines the promotion gate for the M4A Business/BSM wholesale marketplace.

M4A changes commerce authority. A successful local build is not sufficient. The release must prove database reproduction, authorization, B2B price isolation, stale-price rejection, idempotency, inventory reservation, immutable order evidence, browser behavior and accessibility before any production database migration or application deployment.

## Promotion rule

**Do not apply M4A migrations to production and do not merge the M4A release PR until every mandatory gate below is green on the intended release head.**

Production verification happens only after merge/deploy and must not be used as the first place where destructive or disposable M4A tests run.

## Migrations in scope

- `20260829174000_m4a_bsm_wholesale_foundation.sql`
- `20260830063500_m4a_moq_relative_multiple_alignment.sql`

The second migration is a forward correction aligning persistence with the canonical quantity rule:

```text
quantity = MOQ + n × orderMultiple
```

Never rewrite an applied migration to perform this correction.

## Mandatory local/CI gates

### 1. Application verification

Required:

- production foundation verification;
- hosted-M4A fail-closed guard contract;
- ESLint;
- TypeScript;
- production Next.js build;
- dependency audit;
- storage recovery regression;
- malware scanner fail-closed regression;
- operational log-redaction regression;
- canonical checkout client contract regression.

Any failure blocks promotion.

### 2. Fresh database reproduction

Start from a fresh local Supabase stack and replay all repository migrations plus seed data.

Required structural checks include:

- canonical database invariants;
- M2 structural invariants;
- M3 structural invariants;
- `verify-m4a-database-invariants.sql`.

The M4A structural gate must prove:

- RLS on all new M4A tables;
- no anonymous table access;
- no authenticated direct writes;
- expected service-role access;
- required RLS policies/indexes;
- RPC execution grants;
- hardened SECURITY DEFINER search paths;
- offer/cart integrity triggers;
- retail/wholesale cart mode separation;
- immutable wholesale order columns/constraints;
- independent MOQ and order-multiple bounds;
- absence of the obsolete `wholesale_offers_moq_multiple_check` constraint;
- absence of direct `MOQ % orderMultiple` coupling in the canonical offer-save function.

### 3. Preservation regressions

All previously required M1/M2/M3/P0 database regressions must remain green. M4A is not allowed to make wholesale pass by weakening retail, payment, inventory, KYC, admin or trust/safety authority.

### 4. M4A database behavior

Required:

- core wholesale marketplace regression;
- fail-closed wholesale state regression.

The suite must cover at least:

- valid Seller-owned offer creation;
- cross-BSM write denial;
- verified-Business-only offer/tier visibility;
- MOQ and MOQ-relative increment enforcement;
- tier price monotonicity;
- invalid edit transaction rollback;
- future availability window denial;
- Seller capability suspension;
- supplier Business capability suspension;
- purchasing Business verification loss;
- authoritative cart mutation;
- canonical quote/checkout preservation;
- immutable order pricing snapshot;
- inventory reservation.

A deliberate edge fixture must retain non-divisible terms such as MOQ 12 / increment 5 so future code cannot regress to a divisibility assumption.

## Mandatory HTTP authorization gate

Run the real production build against a disposable local Supabase stack.

The historical HTTP authorization suite must remain green, followed by the dedicated M4A HTTP suite.

M4A HTTP requirements:

- anonymous trading-role, offer, catalogue and wholesale-cart access denied;
- ordinary Buyer cannot publish offers;
- ordinary Buyer receives no B2B offer/price leakage;
- verified Supplier BSM can publish owned offers;
- verified Business buyer can see eligible offers;
- ordinary Buyer cannot create wholesale cart lines;
- below-MOQ quantity rejected;
- off-sequence MOQ-relative quantity rejected;
- valid MOQ-relative quantity accepted;
- cross-BSM edit denied;
- quote snapshots contain only server-resolved wholesale terms/prices;
- live price change after quote causes final checkout rejection;
- failed stale-price checkout leaves no usable partial transaction/idempotency state;
- restoring the live price permits checkout with the same idempotency key;
- retrying the successful idempotency key returns the same payment session;
- canonical order/order item totals equal the server-recomputed wholesale price;
- immutable `pricing_snapshot` contains offer, applied tier, MOQ, increment and unit price evidence;
- inventory reservation is created for the final authoritative quantity;
- pausing an offer removes it from sourcing and makes an existing cart line explainably unavailable with zero authoritative price.

## Mandatory authenticated Chromium/WCAG gate

Use disposable Supplier BSM, Retailer BSM and ordinary Buyer identities.

Required pages:

- `/dashboard/bsm`;
- `/dashboard/bsm/wholesale`;
- `/dashboard/bsm/marketplace`;
- the canonical sourced `/products/[slug]` page;
- `/cart`.

Required checks:

- anonymous BSM marketplace request redirects to auth with no B2B product/price leak;
- ordinary Buyer is denied the BSM marketplace with no B2B product/price leak;
- Supplier dashboard exposes trading-role and wholesale navigation;
- Supplier offer manager renders the owned offer;
- Retailer marketplace renders eligible B2B inventory;
- the deliberate MOQ 12 / increment 5 fixture is shown correctly;
- sourced product navigation resolves the canonical product route;
- quantity 52 selects the 52+ tier;
- increment/decrement controls are at least 44px;
- add-to-cart succeeds through the canonical API;
- cart preserves Wholesale mode, MOQ 12, increment 5 and 52+ applied tier;
- no horizontal overflow;
- exactly one global `main#main` and no nested main landmarks;
- no browser console/page errors;
- axe reports no WCAG A/AA violations on covered M4A surfaces.

Store screenshots/artifacts with the workflow run for review.

## Isolated hosted verification

After all local/CI gates pass on the release head, verify M4A against **non-production** hosted infrastructure.

Required isolation:

- Supabase branch/project must not be the canonical production project;
- Vercel environment/deployment must not point to production Supabase;
- disposable test identities/data only;
- exact release SHA must be identifiable in the deployment;
- production app/domain must not be the mutation target.

### Hosted database checks

Before exercising the app:

1. verify the hosted branch is healthy;
2. apply/replay the intended M4A migrations only on the isolated branch;
3. verify all new tables/functions/policies/constraints exist;
4. verify RLS remains enabled;
5. verify the obsolete MOQ-divisibility constraint is absent;
6. run non-production-safe structural and behavioral verification as available.

### Hosted safety preflight

Hosted mutation/browser tests use the repository-owned safety module and wrappers:

- `scripts/m4a-hosted-safety.mjs`;
- `scripts/test-m4a-hosted-http.mjs`;
- `scripts/test-m4a-hosted-browser.mjs`.

Before any disposable commerce fixture is created, the preflight must prove:

- application and Supabase targets are clean HTTPS origins;
- `M4A_HTTP_TEST_ENVIRONMENT` is `preview` or `staging`, never production;
- `M4A_HTTP_ALLOW_REMOTE_MUTATION=true` is explicit;
- `M4A_EXPECTED_COMMIT_SHA` is an exact 40-character Git SHA;
- canonical production EntizNetStore is refused;
- canonical/configured production Supabase is refused;
- protected `.vercel.app` targets have a temporary automation-bypass secret;
- `/api/health` returns HTTP 200 and `status=ok`;
- database, storage and operations readiness checks are all `ok`;
- reported deployment version equals the expected SHA prefix;
- `/api/health.backendBinding` equals the versioned SHA-256 fingerprint of the requested isolated Supabase origin, proving the server-side `SUPABASE_URL` binding without exposing the raw server URL or service key;
- Content Security Policy explicitly contains the isolated Supabase origin and does not reference canonical production Supabase, independently proving the browser/build binding;
- the Vercel bypass header is injected only for the approved application origin, never Supabase/other origins;
- hosted verification does not request a persistent Vercel bypass cookie.

The fail-closed refusal and credential-scoping cases are part of `npm run verify:foundation` and require no network or credentials.

### Hosted application checks

Set the isolated environment values only in the protected verification runner. Never commit or print secrets. Required inputs are:

```text
APP_ORIGIN=https://<isolated-deployment>.vercel.app
SUPABASE_URL=https://<isolated-supabase-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://<isolated-supabase-ref>.supabase.co
SUPABASE_ANON_KEY=<isolated public anon key>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<isolated public anon key>
SUPABASE_SERVICE_ROLE_KEY=<isolated secret service-role key>
M4A_EXPECTED_COMMIT_SHA=<exact 40-char release SHA>
M4A_HTTP_TEST_ENVIRONMENT=staging
M4A_HTTP_ALLOW_REMOTE_MUTATION=true
VERCEL_AUTOMATION_BYPASS_SECRET=<short-lived bypass>
DEPLOYED_PRODUCTION_SUPABASE_URL=https://kllwwurklumhawfsilpd.supabase.co
```

Then run the canonical M4A authority suite through the hosted guard:

```bash
node scripts/test-m4a-hosted-http.mjs
```

For hosted Chromium, install the same isolated Playwright/axe tooling used by the normal HTTP workflow and run:

```bash
PLAYWRIGHT_NODE_MODULES=/tmp/entiznetstore-playwright/node_modules \
  node scripts/test-m4a-hosted-browser.mjs
```

The hosted browser wrapper does **not** fork the browser assertions. It preflights the exact remote target, then exposes that approved deployment through a loopback-only proxy that injects the Vercel bypass only on the Node upstream hop. The unchanged `test-m4a-browser.mjs` suite performs the real Supplier/Retailer/ordinary-Buyer, product, cart, responsive and axe checks.

The proxy must remain fail-closed:

- unexpected browser `Origin`/`Referer` origins are rejected;
- absolute request targets outside the approved deployment origin are rejected;
- malformed or cross-origin upstream redirects are rejected rather than followed;
- hop-by-hop proxy headers are stripped;
- the Vercel bypass credential must never enter page URLs, page JavaScript, screenshots or evidence artifacts.

Exercise real deployed sessions for:

- Supplier BSM offer management;
- verified Business sourcing;
- B2B price isolation from ordinary Buyer/anonymous users;
- MOQ/increment enforcement;
- wholesale cart hydration;
- quote and checkout freeze using a non-production payment/provider configuration that cannot create real charges;
- responsive/authenticated browser surfaces;
- runtime logs for unexpected authorization, database or server errors.

The hosted run must not call or mutate production Supabase.

## Exact-head rule

A gate result is release evidence only if it covers the intended release head or an explicitly documented PR merge SHA containing that head.

After any code, migration, workflow or release-documentation change that can affect behavior or the gate, rerun the relevant exact-head checks. The final merge decision requires a fresh complete matrix for the final PR head.

## Evidence to retain

Record in the PR/release history:

- final branch/head SHA;
- CI workflow run ID and conclusion;
- HTTP/browser workflow run ID and conclusion;
- M4A database test result;
- Chromium/WCAG artifact reference;
- isolated Supabase branch/project reference used for staging verification;
- isolated Vercel deployment/environment and exact SHA;
- hosted health/runtime result including the expected server backend-binding fingerprint match;
- cleanup confirmation for disposable users/data/branches/environments.

Do not store service-role keys, Vercel bypass secrets, bearer tokens or other credentials in evidence artifacts.

## Rollback and failure behavior

### Before production migration

If any gate fails:

- do not merge/promote;
- fix the evidence-backed defect on the feature branch;
- rerun the affected gate;
- rerun the full final matrix after the last behavior-affecting change.

### Hosted isolated environment

If verification fails:

- keep production untouched;
- preserve enough logs/artifacts to diagnose the failure;
- remove disposable identities/data after evidence collection;
- revoke the temporary Vercel automation bypass;
- delete temporary hosted branches/environments when no longer required.

### After production promotion

If the application deploy fails but the database migration is already applied, use forward-compatible application rollback/roll-forward techniques. Do not edit an applied migration in place.

If an M4A database correction is necessary after production application, create a new forward migration with explicit preservation tests.

## Production post-deploy verification

Only after all pre-production gates are green and the approved PR is merged:

1. confirm the exact production deployment SHA;
2. confirm `/api/health` is healthy and the production backend-binding fingerprint matches the canonical production Supabase origin;
3. inspect runtime logs for database/auth/server errors;
4. verify anonymous/ordinary-Buyer B2B price isolation with non-mutating checks;
5. verify authenticated BSM routes with designated safe accounts if available;
6. confirm no migration drift;
7. monitor order/payment/inventory operational telemetry.

Do not run destructive disposable-user matrices against production.

## Release decision

M4A is merge-ready only when the final exact-head CI/database/HTTP/Chromium matrix and isolated hosted verification are all green, evidence is retained, and there is no unresolved launch-blocking security or commerce-integrity defect.
