# EntizNetStore Repository Supply-Chain Controls

Last reviewed: **2026-09-01**

This runbook defines repository-controlled protections that complement, but do not replace, GitHub branch protection/rulesets. `main` remains unprotected at the GitHub host level until P0-06's external governance action is completed and verified through GitHub read APIs.

## Ownership

`.github/CODEOWNERS` assigns the repository owner to the full tree and explicitly calls out release automation, dependency manifests, Supabase migrations, API authority, scripts, operational documentation and the canonical launch-blocker ledger.

CODEOWNERS is not itself an enforcement mechanism. Code-owner review becomes mandatory only when an active GitHub ruleset/branch-protection policy requires it. Until then, releases must continue through feature branches, exact-head automated gates, expected-head locked merges and post-promotion verification.

## Dependency surveillance

`.github/dependabot.yml` enables weekly version-update surveillance for:

- npm dependencies from the repository root;
- GitHub Actions dependencies from the repository root.

Both ecosystems are deliberately bounded to five open update PRs so dependency maintenance cannot flood the release queue. Security fixes should still be prioritized independently of the weekly version-update cadence when GitHub raises them.

Dependabot PRs must pass the same repository tests as ordinary engineering PRs. They do not receive privileged production credentials merely because the author is Dependabot.

## Workflow trust boundary

This public repository must not use `pull_request_target` for application build/test execution. That event evaluates workflow code from the base repository while granting access to the base-repository security context and is too easy to misuse with untrusted pull-request content.

Workflows must also not use `permissions: write-all` or `permissions: read-all`. Each workflow should declare only the GitHub token permissions required for its job. Existing production automation that needs a narrow write capability, such as incident issue creation, must keep that permission explicit and scoped.

The repository foundation verifier scans all workflow YAML and fails if these broad-risk patterns are introduced.

## Mandatory release contexts

GitHub host-level protection must require the six stable check-run contexts recorded in `MAIN_BRANCH_PROTECTION_GATE.md`:

- `verify`
- `database-reproduction`
- `dependency-audit`
- `http-authorization`
- `product-media-provenance`
- `image-egress`

Do not substitute workflow display names for check-run context names.

## Host-level controls still required

Repository files cannot stop an administrator from directly pushing to an unprotected branch. P0-06 therefore remains open until GitHub itself enforces:

- pull-request-only changes to `main`;
- required status checks;
- conversation resolution;
- force-push prohibition;
- branch-deletion prohibition;
- administrator/owner enforcement or an explicitly audited emergency-bypass path.

After activation, verify the rule through GitHub read APIs and run the low-risk blocked-then-green PR rehearsal defined in `MAIN_BRANCH_PROTECTION_GATE.md`.

## Emergency changes

Do not weaken repository governance to accelerate an incident response. If GitHub's emergency bypass is used, record the actor, reason, exact commit, production verification and follow-up restoration PR. Security-sensitive bypasses are incidents, not normal deployment mechanics.
