# EntizNetStore Production Release Procedure

Last reviewed: **2026-08-25**

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

## Preflight

Before merging/deploying a production candidate:

1. Require green GitHub CI for the exact candidate head: production-foundation guard, TypeScript, production build, dependency audit, fresh Supabase replay and all applicable security/commerce regressions.
2. Confirm no pending destructive schema operation. Production database changes must be forward migrations only.
3. Reconcile repository migrations against the live Supabase migration history by migration identity and SQL content. Supabase management-applied timestamps may differ from repository filename timestamps; never rename, rewrite or delete already-applied migration SQL to make timestamps look identical.
4. Confirm the intended Supabase project, Vercel project and production environment. EntizNetStore production currently uses Supabase project `kllwwurklumhawfsilpd` and the dedicated Vercel `entiznetstore` project.
5. Confirm required server-only secrets exist for the feature being released and no privileged value is present in Git, browser bundles or mobile configuration.
6. Confirm external providers required by the release are configured. Payment and payout adapters must remain fail-closed while their provider is intentionally `unconfigured`.
7. Confirm deployment capacity is available. The current Vercel Hobby plan has previously produced build-rate constraints and is not considered a durable public-launch deployment guarantee.
8. Confirm the repository Node engine contract, package-lock root engine metadata and CI runtime remain aligned on Node 22.

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

## Readiness and HTTP smoke verification

The public readiness probe is intentionally minimal:

- `GET /api/health` must return HTTP 200;
- JSON must report `status=ok`, `service=entiznetstore` and `checks.database=ok`;
- it must not expose database rows, credentials, connection strings or provider secrets;
- degraded database readiness returns HTTP 503.

After every production deployment run:

```bash
ENTIZNETSTORE_BASE_URL=https://entiznetstore.vercel.app npm run test:production-http-smoke
```

The smoke runner verifies the public root, readiness, representative anonymous fail-closed messaging/KYC/Admin-integration routes, API `no-store` behavior and core response security headers. Authenticated Buyer/Seller/cross-account/Admin ownership testing is a separate P0-04 requirement and must use dedicated non-production-safe test identities or a controlled production verification procedure; credentials must never be committed.

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
6. Confirm no new public API route uses a development/test/seed/mock/fixture/maintenance/migration route segment and no production API endpoint contains direct verbose console logging.
7. Record any new error signature and owner in the incident/runbook system before broadening traffic.

A clean release check is evidence for a release window; it is not a substitute for P0-07 continuous monitoring/alerts.

## Rollback

If a newly deployed application release is unsafe:

1. Stop promotion/traffic expansion and capture the failing deployment ID, source SHA, request IDs and relevant sanitized logs.
2. Select the most recent `READY` deployment known to be compatible with the current database schema.
3. Roll back/promote that application deployment using Vercel controls when available.
4. Do **not** reverse or rewrite applied migrations. If the database requires correction, ship a new forward migration.
5. Re-run `/api/health`, the production HTTP smoke runner and runtime-error checks after rollback.
6. Document the incident, root cause and follow-up before re-release.

## Environment separation

Production, preview and local/staging environments must not silently share privileged credentials or production-only integration keys. Before public launch, verify environment-variable targeting for:

- Supabase URL/anon key/service role;
- EntizNet Ed25519 user/Admin integration keys and audiences;
- payment and payout provider secrets/webhook keys;
- observability destinations;
- any future malware/content-scanning provider.

Client-exposed values must use only explicitly public configuration. Service-role, signing-private-key and provider-secret values remain server-only.

## Remaining external release conditions

This procedure does not itself clear these launch blockers:

- durable managed/off-platform backups plus a restore rehearsal;
- reliable production deployment capacity beyond rate-limit windows;
- canonical owned production domain with DNS/HTTPS validation;
- final production/preview/staging secret-target isolation review;
- real payment/payout provider sandbox and signed callback E2E;
- production EntizNet Ed25519 signing configuration and authenticated cross-product E2E;
- continuous monitoring/alerting and incident ownership;
- final payment/provider-specific CSP validation.

Record release evidence in repository documentation and update `LAUNCH_BLOCKERS.md` whenever a blocker materially changes.
