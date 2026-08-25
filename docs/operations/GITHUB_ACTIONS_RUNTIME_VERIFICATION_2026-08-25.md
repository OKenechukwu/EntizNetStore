# GitHub Actions runtime verification — 2026-08-25

## Scope

This change closes a P0-06 CI/toolchain compatibility gap caused by GitHub-hosted runners forcing older JavaScript actions from Node.js 20 onto Node.js 24.

The EntizNetStore **application runtime remains Node.js 22**. The upgrade described here concerns the runtime bundled inside GitHub-maintained Actions only.

## Verified upstream versions

As of 2026-08-25, the official current release lines are:

- `actions/checkout`: v7 (`v7.0.1` current release at verification time);
- `actions/setup-node`: v7 (`v7.0.0` current release at verification time);
- `actions/github-script`: v9 (`v9.0.0` current release at verification time).

The repository workflows therefore use the supported major tags rather than the obsolete v4/v7 combinations that generated Node.js 20 deprecation warnings.

## Workflow changes

Active workflows now use:

- `actions/checkout@v7`;
- `actions/setup-node@v7` while still installing application Node.js 22;
- `actions/github-script@v9` in the production monitor.

The production monitor's script uses only the injected `github` and `context` objects and does not rely on the `require('@actions/github')` behavior removed by github-script v9.

## Removed legacy write automation

`.github/workflows/lockfile-sync.yml` was tied only to the historical `codex/m0-production-foundation` branch and had `contents: write` permission so it could commit a regenerated lockfile.

That workflow is no longer part of the canonical release process and is removed instead of being upgraded. Dependency/lockfile changes must now be intentional reviewed source changes followed by `npm ci`, dependency audit, typecheck/build and the normal PR gates.

During implementation, a branch-only one-shot workflow was briefly used to attempt exact text substitutions. GitHub correctly rejected its attempt to update workflow files because the workflow token did not have workflow-definition permission. The temporary workflow was deleted and the active workflow files were then updated through the authorized GitHub connector. No permissions bypass was introduced.

## Permanent guard

`scripts/verify-actions-foundation.mjs` is chained into `npm run verify:foundation` and fails when:

- any required CI/HTTP/production-monitor workflow disappears;
- the obsolete lockfile-sync workflow returns;
- any workflow uses `actions/checkout` older than v7;
- any workflow uses `actions/setup-node` older than v7;
- any workflow uses `actions/github-script` older than v9;
- CI/HTTP stop explicitly using application Node.js 22;
- the production monitor loses `persist-credentials: false`, Node.js 22, or the current first-party Actions majors.

This is a compatibility floor, not a permanent maximum. Future supported major upgrades should update the verifier deliberately with release evidence.

## Merge gate

Before merge:

1. `verify:foundation` must pass with the Actions guard active;
2. CI must no longer emit the GitHub warning that checkout/setup-node target Node.js 20;
3. lint, storage recovery, operational logging, typecheck and production build must pass;
4. fresh-Supabase M1/M2/M3/commerce/payment/payout/concurrency regressions must pass;
5. HTTP Authorization Regression must pass;
6. production monitor YAML must remain valid and retain least-privilege permissions;
7. no temporary write-capable migration workflow may remain in the tree.
