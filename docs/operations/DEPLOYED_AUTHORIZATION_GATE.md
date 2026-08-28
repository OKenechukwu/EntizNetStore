# EntizNetStore deployed authorization gate

Status: P0-04 production-like authenticated verification contract.

## Goal

Local fresh-Supabase HTTP regression proves repository authorization behavior, but it does not prove that a deployed HTTPS runtime is wired to the intended session, environment and server authorization contracts. This gate closes that gap using a controlled **preview or staging** deployment and a separate non-production Supabase target.

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
- `/api/health` is healthy and reports the expected deployment commit.

The canonical production anchors are hard-coded into the runner as a final deny boundary:

- application: `https://entiznetstore.vercel.app`;
- Supabase: `https://kllwwurklumhawfsilpd.supabase.co`.

`ENTIZNETSTORE_PRODUCTION_SUPABASE_URL`, when configured as a GitHub environment/repository variable, adds another deny comparison. It is defense in depth and is not the only protection against accidentally mutating production.

`DEPLOYED_AUTH_SUPABASE_SERVICE_ROLE_KEY` exists only in the GitHub environment secret store used by this gate. It is consumed by the Node test process to create and remove disposable identities. It is never sent to the deployed application, browser code, logs or artifacts.

Vercel Deployment Protection remains enabled. Protected preview requests use the server-side `VERCEL_AUTOMATION_BYPASS_SECRET` through the documented `x-vercel-protection-bypass` header. `scripts/deployed-vercel-bypass.mjs` injects that header only when a request targets the exact configured application origin; requests to Supabase or any other origin never receive the Vercel bypass secret.

## Environment binding requirement

The **deployed preview/staging application and the GitHub verification environment must point to the same isolated Supabase project or branch**.

It is not sufficient to place staging Supabase keys only in GitHub Actions while the Vercel deployment still uses production Supabase environment variables. Before invoking this gate, configure the target Vercel preview/staging deployment with the same non-production Supabase URL and publishable/anon credentials represented by:

- `DEPLOYED_AUTH_SUPABASE_URL`;
- `DEPLOYED_AUTH_SUPABASE_ANON_KEY`.

The application keeps its normal server-only Supabase credentials in Vercel; the GitHub runner keeps the disposable-test service-role key in its protected GitHub environment. Never expose a service-role credential to client-side Vercel variables.

The gate proves this binding behaviorally: its authenticated cookies are minted directly against `DEPLOYED_AUTH_SUPABASE_URL`. The deployed application must successfully resolve those sessions, capabilities and authorized mutations. If the deployment is connected to production or any other Supabase target, the session checks fail rather than silently passing against the wrong backend.

## GitHub environment contract

Create protected environments named:

- `entiznetstore-preview-verification`
- `entiznetstore-staging-verification`

Each environment used for this gate needs:

- secret `DEPLOYED_AUTH_SUPABASE_URL`;
- secret `DEPLOYED_AUTH_SUPABASE_ANON_KEY`;
- secret `DEPLOYED_AUTH_SUPABASE_SERVICE_ROLE_KEY`;
- secret `VERCEL_AUTOMATION_BYPASS_SECRET` when the target deployment uses Vercel Deployment Protection.

Optional repository/environment variable:

- `ENTIZNETSTORE_PRODUCTION_SUPABASE_URL` — an additional production-origin deny comparison. It contains no service-role credential.

Preview and staging must use non-production Supabase projects/branches. Do not populate these values with the canonical production project merely to make the gate runnable.

## Exact commit execution

The workflow input `expected_commit` is not merely compared with `/api/health`. GitHub Actions checks out that **exact SHA** with credentials persistence disabled before installing dependencies and executing the harness. This prevents a manual workflow dispatch from running test code from one branch while claiming evidence for a different deployed commit.

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
13. authenticated Buyer, Seller, Business/BSM and Admin dashboard HTTP rendering;
14. deterministic cleanup and zero-row verification for the disposable identities.

Cleanup includes the profile/KYC rows created directly by onboarding plus selected user-scoped state, audit and support rows that could otherwise block auth-user deletion if a protected route gains side effects later. Auth-user deletion follows application-row cleanup.

Cleanup failure is a gate failure. The job does not claim success while disposable identities remain unexpectedly undeletable.

## Evidence artifact

Every executed gate writes `tmp/deployed-auth-evidence.json` and GitHub Actions uploads it as:

`deployed-auth-evidence-<github-run-id>`

The artifact records the target application origin, target Supabase origin, exact expected and observed commit, timestamps, the verification checks performed, disposable identity count, cleanup verification and final result. It intentionally contains **no Supabase keys, service-role secret, passwords or session cookies**.

The artifact upload runs with `if: always()` so a substantive authorization failure still leaves evidence when the Node runner reached execution. A preflight refusal before the test runner starts may have no evidence file by design; such a run is not P0-04 completion evidence.

Artifacts are retained for 30 days by the workflow. Release evidence that must outlive that window should be summarized in the repository launch/release documentation.

## Invocation

Run **Deployed Authorization Gate** manually after an exact preview/staging deployment is READY. Supply:

- exact deployment origin URL;
- exact 40-character Git commit expected from `/api/health`;
- `preview` or `staging`;
- explicit disposable-mutation consent.

The workflow uses a protected GitHub environment so target credentials and the Vercel automation bypass remain scoped separately from ordinary CI.

## P0-04 completion evidence

P0-04 can move from `IN PROGRESS` to `VERIFIED` when:

- ordinary fresh-database CI remains green;
- local HTTP authorization regression remains green;
- the release-candidate Vercel preview/staging deployment is wired to the isolated non-production Supabase target;
- this deployed gate passes against that exact production-like deployment;
- the run ID, exact target deployment, exact commit, target Supabase origin and cleanup result are recorded;
- the evidence artifact contains no credentials and confirms successful cleanup;
- the gate is repeated after material session/auth/RLS architecture changes.
