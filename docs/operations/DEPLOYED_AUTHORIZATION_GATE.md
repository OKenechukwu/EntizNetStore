# EntizNetStore deployed authorization gate

Status: P0-04 production-like authenticated verification contract.

## Goal

Local fresh-Supabase HTTP regression proves repository authorization behavior, but it does not prove that a deployed HTTPS runtime is wired to the intended session, environment and server authorization contracts. This gate closes that gap using a controlled **preview or staging** deployment and a separate non-production Supabase target.

Production is intentionally not the fixture environment.

## Safety rules

The gate refuses to run unless all of the following are true:

- target application URL uses HTTPS;
- `DEPLOYED_AUTH_TEST_ENVIRONMENT` is `preview` or `staging`;
- explicit disposable-mutation consent is `true`;
- target Supabase origin differs from the configured production Supabase origin;
- canonical EntizNetStore production host is not the target;
- required server-side target credentials are present;
- `/api/health` is healthy and, when supplied, reports the exact expected deployment commit.

`DEPLOYED_AUTH_SUPABASE_SERVICE_ROLE_KEY` exists only in the GitHub environment secret store used by this gate. It is consumed by the Node test process to create and remove disposable identities. It is never sent to the deployed application, browser code, logs or artifacts.

Vercel Deployment Protection remains enabled. Protected preview requests use the server-side `VERCEL_AUTOMATION_BYPASS_SECRET` through the documented `x-vercel-protection-bypass` header. `scripts/deployed-vercel-bypass.mjs` injects that header only when a request targets the exact configured application origin; requests to Supabase or any other origin never receive the Vercel bypass secret.

## GitHub environment contract

Create protected environments named:

- `entiznetstore-preview-verification`
- `entiznetstore-staging-verification`

Each environment used for this gate needs:

- secret `DEPLOYED_AUTH_SUPABASE_URL`
- secret `DEPLOYED_AUTH_SUPABASE_ANON_KEY`
- secret `DEPLOYED_AUTH_SUPABASE_SERVICE_ROLE_KEY`
- secret `VERCEL_AUTOMATION_BYPASS_SECRET` when the target deployment uses Vercel Deployment Protection

Repository/environment variable:

- `ENTIZNETSTORE_PRODUCTION_SUPABASE_URL` — canonical production Supabase URL used only as a deny comparison. It contains no service-role credential.

Preview and staging must use non-production Supabase projects/branches. Do not populate these values with the canonical production project merely to make the gate runnable.

## Verification matrix

`scripts/test-deployed-auth-authorization.mjs` performs:

1. canonical `/api/health` readiness and exact-commit verification;
2. anonymous capability and Admin-route denial;
3. disposable Buyer, Seller, Business/BSM and Admin identity creation;
4. canonical Buyer, Seller and Business onboarding over the deployed HTTPS application;
5. deployed session capability resolution for Buyer, Seller, Business and Admin;
6. additive Buyer+Seller+Business verification for BSM;
7. Buyer self-profile mutation;
8. Buyer denial at Seller storefront mutation;
9. Seller self-scoped storefront mutation;
10. ordinary Buyer denial at the Admin account boundary;
11. trusted Admin access at that same boundary;
12. authenticated Buyer, Seller, Business/BSM and Admin dashboard HTTP rendering;
13. cleanup of the exact application rows created by onboarding followed by auth-user deletion.

Cleanup failure is a gate failure. The job does not claim success while disposable identities remain unexpectedly undeletable.

## Invocation

Run **Deployed Authorization Gate** manually after an exact preview/staging deployment is READY. Supply:

- exact deployment URL;
- exact Git commit expected from `/api/health`;
- `preview` or `staging`;
- explicit disposable-mutation consent.

The workflow uses a protected GitHub environment so target credentials and the Vercel automation bypass remain scoped separately from ordinary CI.

## P0-04 completion evidence

P0-04 can move from `IN PROGRESS` toward `VERIFIED` when:

- ordinary fresh-database CI remains green;
- local HTTP authorization regression remains green;
- this deployed gate passes against the release-candidate production-like environment;
- the run ID, exact target deployment, exact commit and cleanup result are recorded;
- the gate is repeated after material session/auth/RLS architecture changes.
