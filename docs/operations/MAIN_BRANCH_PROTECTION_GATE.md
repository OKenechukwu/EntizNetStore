# EntizNetStore Main Branch Protection Gate

Last reviewed: **2026-09-01**

`main` is the production release branch. This document defines the repository-governance controls required before P0-06 can be marked verified.

## Current observed state

At the PR #44 production promotion checkpoint, GitHub reported:

- branch: `main`
- protection enabled: **false**
- required status checks: none

The application release process already uses feature branches, PRs, exact-head CI, Vercel previews and expected-head locked merges, but those practices are not yet enforced by repository policy. A direct push or forceful administrative action could therefore bypass the intended release path.

The connected GitHub automation in the 2026-09-01 development session exposes protection/ruleset reads but no protection/ruleset write action. Repository protection remains an external governance action; do not emulate it by force-moving refs or adding fragile workflow-only checks.

## Required production policy

Apply a repository ruleset or equivalent classic branch protection specifically to `refs/heads/main` with these minimum controls:

1. Require changes to reach `main` through a pull request.
2. Do not require a human approval count solely for routine engineering if the owner wants autonomous release execution; the PR itself plus mandatory automated gates is the minimum release boundary.
3. Require conversation resolution before merge.
4. Require the branch to be up to date with `main` before merge, or otherwise ensure the exact tested PR head is based on current `main`.
5. Require these exact GitHub check contexts, observed on the fully-green PR #44 head:
   - `verify`
   - `database-reproduction`
   - `dependency-audit`
   - `http-authorization`
   - `product-media-provenance`
   - `image-egress`
6. Block force pushes to `main`.
7. Block deletion of `main`.
8. Apply enforcement to administrators/owners so the normal release path cannot be silently bypassed.
9. Do not require linear history while the repository intentionally uses verified merge commits.
10. Do not require signed feature-branch commits until the GitHub/API automation signing model is explicitly designed; the production merge commits created by GitHub are already verifiable.

## Why these checks are mandatory

`verify` covers the production application foundation, lint, failure-recovery regressions, TypeScript and build.

`database-reproduction` proves a fresh Supabase database can replay the repository migration chain and pass identity, RLS, commerce, payment, payout, wholesale and security regressions. It includes the independent payment-initialization and payout concurrency tests.

`dependency-audit` rejects high-severity production dependency vulnerabilities according to the CI policy.

`http-authorization` exercises real HTTP and Chromium authorization/browser boundaries against a fresh local Supabase stack.

`product-media-provenance` protects the product-media attach/retire authority and real PostgREST boundary, including concurrency.

`image-egress` protects the application image-egress/remote-image security boundary.

These contexts are intentionally named by the check-run names GitHub reports, not by guessed workflow display labels.

## Vercel checks

Vercel preview readiness remains part of release review, but the branch-protection minimum above does not make `Vercel Preview Comments` a mandatory context. That check describes toolbar-feedback state, not application correctness. If Vercel exposes a stable deployment-readiness status context suitable for rulesets, it may be added after verifying its exact name and behavior across PRs.

## Verification after policy activation

Do not mark P0-06 repository protection complete until all of the following are observed through GitHub's branch/ruleset read API:

- `main` is protected by an active rule/ruleset;
- PR requirement is active;
- all six required check contexts are active;
- force push is disabled;
- branch deletion is disabled;
- administrator/owner bypass is disabled or explicitly constrained to an audited emergency path.

Then run one low-risk documentation PR through the protected flow and verify that GitHub refuses merge while a required check is pending and allows merge only after the complete gate is green.

## Emergency override

If an emergency bypass is ever enabled, it must be treated as an incident-control mechanism, not normal deployment workflow. Record who used it, why, the exact commit, post-deployment verification and the follow-up PR that restores the normal tested history.
