# EntizNetStore deployed authorization gate

Status: **P0-04 VERIFIED on 2026-08-29; reusable release gate retained.**

## Goal

Fresh-Supabase HTTP regression proves repository authorization behavior, but it does not prove that a deployed HTTPS runtime is wired to the intended session, environment and server authorization contracts. This gate closes that gap using a controlled **preview or staging** deployment and a separate non-production Supabase target.

Production is intentionally not the fixture environment.

## Safety rules

The gate refuses to run unless all of the following are true:

- target application URL uses HTTPS and is supplied as an origin URL, not a path-scoped URL;
- `DEPLOYED_AUTH_TEST_ENVIRONMENT` is `preview` or `staging`;
- explicit disposable-mutation consent is `true`;
- `DEPLOYED_AUTH_EXPECTED_COMMIT` is an exact 40-character Git SHA;
- target Supabase origin differs from the canonical production Supabase origin;
- canonical EntizNetStore production host is not the target;
- required server-side target credentials are present;
- `/api/health` is healthy and reports the expected deployment commit;
- Chromium can complete the global age-verification gate and hydrate each protected role surface without redirecting away, rendering a Next.js error overlay or raising a browser page error.

The canonical production anchors are hard-coded into the runner as a final deny boundary:

- application: `https://entiznetstore.vercel.app`;
- Supabase: `https://kllwwurklumhawfsilpd.supabase.co`.

`ENTIZNETSTORE_PRODUCTION_SUPABASE_URL`, when configured as a GitHub environment/repository variable, adds another deny comparison. It is defense in depth and is not the only protection against accidentally mutating production.

`DEPLOYED_AUTH_SUPABASE_SERVICE_ROLE_KEY` exists only in the GitHub environment secret store used by this gate. It is consumed by the Node test process to create and remove disposable identities. It is never sent to browser code, logs or artifacts.

Vercel Deployment Protection remains enabled. Protected preview requests use `VERCEL_AUTOMATION_BYPASS_SECRET` through the documented `x-vercel-protection-bypass` header. `scripts/deployed-vercel-bypass.mjs` injects the bypass only for requests to the exact configured application origin; Supabase and all other origins are untouched. The wrapper does not request a Vercel bypass cookie because that cookie-establishment flow can intentionally redirect and conflict with fail-closed `redirect: 'manual'` authorization assertions.

## Environment binding requirement

The **deployed preview/staging application and the GitHub verification environment must point to the same isolated Supabase project or branch**.

It is not sufficient to place staging Supabase keys only in GitHub Actions while the Vercel deployment still uses production Supabase environment variables. Before invoking this gate, configure the target Vercel preview/staging deployment with the same non-production Supabase target represented by:

- `DEPLOYED_AUTH_SUPABASE_URL`;
- `DEPLOYED_AUTH_SUPABASE_ANON_KEY`;
- the corresponding server-only service-role credential in the deployment environment.

The GitHub runner separately stores its disposable-test service-role key. Never expose a service-role credential through `NEXT_PUBLIC_*` variables or browser bundles.

The gate proves environment binding behaviorally: authenticated cookies are minted directly against `DEPLOYED_AUTH_SUPABASE_URL`. The deployed application must successfully resolve those same sessions, capabilities and authorized mutations. If the deployment is wired to production or any different Supabase target, the session checks fail.

## GitHub environment contract

Protected environments:

- `entiznetstore-preview-verification`
- `entiznetstore-staging-verification`

Each environment used for the durable manual gate needs:

- secret `DEPLOYED_AUTH_SUPABASE_URL`;
- secret `DEPLOYED_AUTH_SUPABASE_ANON_KEY`;
- secret `DEPLOYED_AUTH_SUPABASE_SERVICE_ROLE_KEY`;
- secret `VERCEL_AUTOMATION_BYPASS_SECRET` when the target deployment uses Vercel Deployment Protection.

Optional repository/environment variable:

- `ENTIZNETSTORE_PRODUCTION_SUPABASE_URL` — an additional production-origin deny comparison; it contains no service-role credential.

Preview and staging must use non-production Supabase projects/branches. Do not populate these values with the canonical production project merely to make the gate runnable.

## Exact commit execution

The workflow input `expected_commit` is not merely compared with `/api/health`. GitHub Actions checks out that **exact SHA** with credentials persistence disabled before installing dependencies and executing the harness.

The deployed `/api/health` response must report the same 12-character commit prefix. A mismatch fails the run before disposable identities are used for authorization assertions.

## Verification matrix

`scripts/test-deployed-auth-authorization.mjs` performs:

1. canonical `/api/health` readiness and exact-commit verification;
2. anonymous capability and Admin-route denial;
3. disposable Buyer, Seller, Business/BSM and Admin identity creation;
4. canonical Buyer, Seller and Business onboarding over the deployed HTTPS application;
5. deployed session capability resolution for Buyer, Seller, Business and Admin;
6. explicit proof that target-minted sessions are accepted by the deployed app;
7. additive Buyer+Seller+Business verification for BSM;
8. Buyer self-profile mutation;
9. Buyer denial at Seller storefront mutation;
10. Seller self-scoped storefront mutation;
11. ordinary Buyer denial at the Admin account boundary;
12. trusted Admin access at that same boundary;
13. isolated Chromium session injection for Buyer, Seller, Business/BSM and Admin;
14. accessible 18+ age-verification completion and persistence when the global gate is presented;
15. hydrated route-specific UI verification on `/dashboard/buyer`, `/dashboard/seller`, `/dashboard/bsm` and `/admin`;
16. exact protected-route retention after hydration, with no redirect away from the authorized route;
17. no visible application/internal/not-found framework error, no Next.js error overlay and no browser `pageerror` events;
18. deterministic application-row/auth-user cleanup and zero-row verification for all disposable identities.

Cleanup includes profile/KYC rows created directly by onboarding plus selected user-scoped state, audit and support rows that could otherwise block auth-user deletion if a protected route gains side effects later. Auth-user deletion follows application-row cleanup.

Cleanup failure is a gate failure. The job does not claim success while disposable identities remain unexpectedly undeletable.

## Evidence artifact

Every executed gate writes `tmp/deployed-auth-evidence.json` and GitHub Actions uploads it as:

`deployed-auth-evidence-<github-run-id>`

The artifact records the target application origin, target Supabase origin, exact expected and observed commit, timestamps, verification checks, disposable identity count, cleanup verification and final result. It intentionally contains **no Supabase keys, service-role secret, passwords, Vercel bypass secret or session cookies**.

The artifact upload runs with `if: always()` so a substantive authorization failure still leaves evidence when the Node runner reached execution. A preflight refusal before the test runner starts may have no evidence file by design; such a run is not completion evidence.

Artifacts are retained for 30 days. Durable release evidence is summarized below and in `LAUNCH_BLOCKERS.md`.

## Invocation

Run **Deployed Authorization Gate** manually after an exact preview/staging deployment is READY. Supply:

- exact deployment origin URL;
- exact 40-character Git commit expected from `/api/health`;
- `preview` or `staging`;
- explicit disposable-mutation consent.

The workflow uses a protected GitHub environment so target credentials and the Vercel automation bypass remain scoped separately from ordinary CI.

## P0-04 completion evidence — 2026-08-29

The production-like isolated verification was completed before the reusable gate was finalized:

- temporary verification PR: **#34**, retained only as verification scaffolding and explicitly **not mergeable into production architecture**;
- exact tested source commit: `1f0d7c69c4aa716695144fb03aa87627736d9b7f`;
- exact immutable Vercel deployment: `dpl_6W1RdZyqWXu2rsnzL8FAVKDaRQEY`;
- exact deployment URL: `https://entiznetstore-8puxekvh2-okenechukwus-projects.vercel.app`;
- isolated Supabase target: `https://peyzicveqigxcrbjzfse.supabase.co`;
- GitHub hosted verification run: `33243049961`;
- hosted verification job: `99075565023`;
- evidence artifact: `p0-04-deployed-auth-evidence-33243049961`, artifact ID `9711951711`;
- result: `passed`;
- observed `/api/health` version: `1f0d7c69c4aa`;
- database, storage and operations readiness: all `ok`;
- disposable identities created: `4`;
- disposable identities deleted: `4`;
- cleanup failures: `0`;
- Buyer, Seller, Business/BSM and Admin browser journeys all remained on their expected protected routes after age verification and hydration;
- temporary Vercel automation bypass was revoked successfully at job completion.

The same temporary source also passed the full CI/fresh-database run `33243053080`. Its local HTTP/browser run exposed a pre-existing Seller verification-link contrast defect rather than an authorization defect; PR #35 fixes that WCAG issue and must pass the full HTTP/Chromium gate before merge.

## Re-verification policy

P0-04 is not a one-time exemption. Re-run the deployed gate after any material change to:

- Supabase auth/session cookie architecture;
- capability resolution or Admin authority;
- RLS or browser-callable privileged RPC surface;
- protected-route server/client authorization behavior;
- Vercel deployment protection/session transport;
- production-like environment binding.

Any future browser-callable privileged RPC addition remains subject to the explicit reviewed allow-list and ordinary CI guards.
