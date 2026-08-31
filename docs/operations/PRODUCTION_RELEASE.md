# EntizNetStore Production Release Procedure

Last reviewed: **2026-08-31**

This runbook defines the minimum release, health, rollback and migration-reconciliation procedure for EntizNetStore. It does not override `LAUNCH_BLOCKERS.md`; public launch remains blocked until every P0 requirement is verified.

## Release identity

Every release must be tied to an exact Git commit. Record:

- repository: `OKenechukwu/EntizNetStore`;
- exact `main` commit SHA;
- pull request and successful CI run;
- applied forward migrations, when any;
- Vercel production deployment ID and source SHA;
- post-deploy HTTP/runtime verification evidence.

Never treat a branch name, local working tree or UI-only preview as release identity.

The canonical production smoke can enforce release identity by comparing the expected Git SHA with the 12-character `version` returned by `/api/health`. A healthy but stale deployment is therefore a release failure, not a successful health check.

## Preflight

Before merging/deploying a production candidate:

1. Require green GitHub CI for the exact candidate head: production-foundation guard, TypeScript, production build, dependency audit, fresh Supabase replay and all applicable security/commerce regressions.
2. Confirm no pending destructive schema operation. Production database changes must be forward migrations only.
3. Reconcile repository migrations against the live Supabase migration history by migration identity and SQL content. Supabase management-applied timestamps may differ from repository filename timestamps; never rename, rewrite or delete already-applied migration SQL to make timestamps look identical.
4. Confirm the intended Supabase project, Vercel project and production environment. EntizNetStore production currently uses Supabase project `kllwwurklumhawfsilpd` and the dedicated Vercel `entiznetstore` project.
5. Confirm required server-only secrets exist for the feature being released and no privileged value is present in Git, browser bundles or mobile configuration.
6. Confirm external providers required by the release are configured. Payment and payout adapters must remain fail-closed while their provider is intentionally `unconfigured`; public uploads must remain fail-closed while the production scanner is not launch-ready.
7. Confirm deployment capacity is available. The Vercel team is now on Pro, but plan tier alone is not capacity evidence. Run the bounded production read-capacity gate at the approved envelope before launch or after material infrastructure changes.
8. Confirm the repository Node engine contract, package-lock root engine metadata and CI runtime remain aligned on Node 22.
9. Confirm `main` repository protection/ruleset is enabled before public launch. Direct pushes, force pushes and branch deletion must not bypass the required PR/status-check path.

## Canonical Node.js runtime

EntizNetStore currently standardizes production, CI and HTTP authorization regression on **Node.js 22.x**. The repository contract is `engines.node = ">=22 <23"`.

Vercel may display a different project-level default, but its documented behavior is that `package.json` engine configuration overrides that setting. Production build evidence on 2026-08-25 confirmed that the repository engine forced Node 22.x even while the project setting displayed 24.x.

Do not upgrade the Node major by changing only the hosting dashboard. A runtime-major change must update the repository contract and lock metadata together, pass the complete CI and HTTP authorization suites, and be re-verified from the production build log after deployment. Evidence is recorded in `docs/operations/DEPLOYMENT_RUNTIME_SECURITY_VERIFICATION_2026-08-25.md`.

## Database rollout

When a release includes migrations:

1. Capture the current migration list and a production recovery checkpoint before the change.
2. Apply only new forward migrations in repository order.
3. Never roll back an applied production migration by editing history. Correct schema mistakes with a new forward migration.
4. Run post-migration invariants, RLS/privilege checks and relevant SQL regression suites.
5. Record both the repository migration filename/version and the management-recorded live version if Supabase records a different timestamp.
6. Stop the application rollout if database verification fails.

Application rollback is safe only when the target application remains compatible with the already-applied database schema.

## Application rollout

1. Merge only the exact green candidate into `main`.
2. Confirm Vercel creates a production deployment sourced from the exact merge SHA.
3. Require the deployment to reach `READY` before declaring the application rollout complete.
4. Verify the canonical HTTPS endpoint, not only the deployment-specific preview URL.
5. Verify `/api/health.version` matches the expected merge SHA prefix before broadening traffic.

## Readiness and HTTP smoke verification

The public readiness probe is intentionally minimal and non-secret:

- `GET /api/health` must return HTTP 200;
- JSON must report `status=ok`, `service=entiznetstore`, and DB/Storage/operations checks as `ok`;
- `version` is the first 12 characters of the Vercel Git source SHA when available;
- `launchGates.uploadSafety` reports only `configured` or `blocked` and must not expose scanner endpoints/tokens/failure details;
- it must not expose database rows, credentials, connection strings or provider secrets;
- degraded core readiness returns HTTP 503.

After every production deployment run the exact-SHA gate:

```bash
ENTIZNETSTORE_BASE_URL=https://entiznetstore.vercel.app \
ENTIZNETSTORE_EXPECTED_SHA=<full-main-merge-sha> \
npm run test:production-http-smoke
```

The smoke runner verifies the public root, exact deployment identity, readiness, bounded upload-safety launch signal, representative anonymous fail-closed messaging/KYC/Admin-integration routes, API `no-store` behavior and core response security headers. Authenticated Buyer/Seller/cross-account/Admin ownership testing is a separate reusable authorization gate and must use dedicated isolated identities; credentials must never be committed.

The scheduled production monitor runs this smoke every 15 minutes and binds `ENTIZNETSTORE_EXPECTED_SHA` to the exact `main` SHA of the monitor run. It retries five times over a short deployment-convergence window before opening/updating an incident. This prevents a temporarily deploying release from creating an immediate false positive while still treating a persistent stale deployment as an incident.

## Bounded production capacity gate

Production capacity checks are intentionally read-only and manual-only. Use `.github/workflows/production-capacity.yml`; do not create ad-hoc high-volume traffic against production.

Safety boundary:

- workflow dispatch only; no schedule/push/PR trigger;
- must run from `main`;
- explicit confirmation phrase `RUN_READ_ONLY_CAPACITY_GATE`;
- target hard-bound to `https://entiznetstore.vercel.app`;
- exact deployed SHA must match the workflow's `main` SHA;
- only `GET /` and `GET /api/health` are exercised;
- concurrency is capped at 25;
- requests per path are capped at 250 (500 total maximum);
- request timeout is bounded;
- p95 latency and failure-rate thresholds are declared before execution.

Default envelope is intentionally conservative: concurrency 4, 20 requests per path, p95 <= 2500 ms and failure rate <= 1%. Record the workflow run, exact SHA, inputs and JSON summary as launch evidence. If the approved launch traffic model requires a larger envelope, define it explicitly and review it before increasing the bounded caps.

Detailed procedure: `docs/operations/PRODUCTION_CAPACITY.md`.

## Security-header review

Production responses must include the repository-defined baseline headers. In particular:

- production CSP must not contain `unsafe-eval`;
- `object-src 'none'`, `frame-ancestors 'none'` and a restrictive base/form policy remain enforced;
- API responses are `private, no-store` and `noindex`;
- content-type sniffing is disabled;
- framing is denied;
- referrer and permissions policies are explicit.

The CSP must be reviewed again when a real payment processor, payout flow, external fraud/identity provider or other third-party browser integration is selected. Do not broaden production CSP speculatively.

## Runtime verification

After deployment:

1. Check Vercel grouped runtime errors for the release window.
2. Review error logs for health, authentication, storage, checkout/payment/refund/payout and EntizNet integration failures relevant to the release.
3. Confirm logs do not contain tokens, assertions, service-role values, signed upload tokens or full provider secret payloads.
4. Run representative fail-closed integration checks. Unsigned EntizNet Admin API calls must remain unauthorized.
5. Confirm the production build log selected Node 22.x from the repository engine contract.
6. Confirm the production deployment source SHA and `/api/health.version` match the expected `main` release.
7. Confirm no new public API route uses a development/test/seed/mock/fixture/maintenance/migration route segment and no production API endpoint contains direct verbose console logging.
8. Record any new error signature and owner in the incident/runbook system before broadening traffic.

A clean release check is evidence for a release window; it is not a substitute for P0-07 continuous monitoring/alerts.

## Rollback

If a newly deployed application release is unsafe:

1. Stop promotion/traffic expansion and capture the failing deployment ID, source SHA, request IDs and relevant sanitized logs.
2. Select the most recent `READY` deployment known to be compatible with the current database schema.
3. Roll back/promote that application deployment using Vercel controls when available.
4. Do **not** reverse or rewrite applied migrations. If the database requires correction, ship a new forward migration.
5. Re-run `/api/health`, the exact-SHA production HTTP smoke runner and runtime-error checks after rollback. For rollback verification, the expected SHA is the intentionally restored compatible deployment SHA, not the abandoned release SHA.
6. Document the incident, root cause and follow-up before re-release.

## Repository protection gate

Public launch requires protection of `main` in GitHub. At minimum:

- changes enter through pull requests;
- required CI/status checks cannot be bypassed by routine direct push;
- force pushes and branch deletion are blocked;
- stale approvals/status results are not silently treated as current after the head changes;
- administrators/maintainers use the same production-safe path except for a documented break-glass incident procedure.

The connected GitHub automation can inspect but cannot currently create repository rulesets/branch protection. Until this control is configured in GitHub and re-read as enabled, it remains an external P0-06 launch condition.

## Environment separation

Production, preview and local/staging environments must not silently share privileged credentials or production-only integration keys. Before public launch, verify environment-variable targeting for:

- Supabase URL/anon key/service role;
- EntizNet Ed25519 user/Admin integration keys and audiences;
- payment and payout provider secrets/webhook keys;
- observability destinations;
- malware/content-scanning provider and its exact egress origin allowlist;
- backup/recovery credentials and encryption-key ownership.

Client-exposed values must use only explicitly public configuration. Service-role, signing-private-key and provider-secret values remain server-only.

## Remaining external release conditions

This procedure does not itself clear these launch blockers:

- durable encrypted off-platform backup plus a successful isolated restore rehearsal;
- production `main` branch/ruleset protection;
- bounded production capacity evidence at the approved launch envelope;
- canonical owned production domain with DNS/HTTPS validation;
- final production/preview/staging secret-target isolation review;
- approved real upload scanner and live clean/blocked/error/timeout verification;
- real payment/payout provider sandbox and signed callback E2E;
- production EntizNet Ed25519 signing configuration and authenticated cross-product E2E;
- external logging/alerting ownership and final incident rehearsal;
- final provider-specific CSP validation.

Record release evidence in repository documentation and update `LAUNCH_BLOCKERS.md` whenever a blocker materially changes.
