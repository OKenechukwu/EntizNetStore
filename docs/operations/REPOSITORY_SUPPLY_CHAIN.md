# EntizNetStore Repository Supply-Chain Controls

Last reviewed: **2026-09-02**

This runbook defines repository-controlled protections that complement, but do not replace, GitHub branch protection/rulesets. `main` remains unprotected at the GitHub host level until P0-06's external governance action is completed and verified through GitHub read APIs.

## Ownership

`.github/CODEOWNERS` assigns the repository owner to the full tree and explicitly calls out release automation, dependency manifests, Supabase migrations, API authority, scripts, operational documentation and the canonical launch-blocker ledger.

CODEOWNERS is not itself an enforcement mechanism. Code-owner review becomes mandatory only when an active GitHub ruleset/branch-protection policy requires it. Until then, releases must continue through feature branches, exact-head automated gates, expected-head locked merges and post-promotion verification.

## Dependency surveillance

`.github/dependabot.yml` enables weekly version-update surveillance for:

- npm dependencies from the repository root;
- GitHub Actions dependencies from the repository root.

Both ecosystems are deliberately bounded to five open update PRs so dependency maintenance cannot flood the release queue. Security fixes should still be prioritized independently of the weekly version-update cadence when GitHub raises them.

Routine major-version version updates are suppressed for both npm and GitHub Actions during launch hardening. Patch and minor version updates remain visible, while framework/toolchain major upgrades such as TypeScript, Tailwind, Node typings or Action major migrations must be opened as deliberate engineering slices with migration notes and the full release gate.

The major-version ignore entries use Dependabot's `version-update:semver-major` semantics. They govern routine version updates; security updates are not treated as routine version-update majors and must remain visible through the repository's Dependabot security-update path. A security update that requires a breaking major jump is therefore a security engineering event, not something to silence for launch convenience.

Dependabot PRs must pass the same repository tests as ordinary engineering PRs. They do not receive privileged production credentials merely because the author is Dependabot.

## Immutable GitHub Actions

Every remote `uses:` reference in `.github/workflows` must be pinned to a reviewed **full 40-character commit SHA**. Mutable tags and branches such as `@main`, `@v1`, `@v7` or `@latest` are not accepted release dependencies even when the corresponding upstream project is trusted.

The repository currently allows only the reviewed action packages and commits frozen by `scripts/verify-repository-governance.mjs`:

- `actions/checkout`;
- `actions/setup-node`;
- `actions/github-script`;
- `actions/upload-artifact`;
- `supabase/setup-cli`.

Human-readable major-version comments may remain beside the SHA for maintenance context, but the executable reference is the immutable commit. Dependabot's `github-actions` ecosystem is the intended update path: a proposed Action revision must arrive as a PR, pass the complete release gate, and be reviewed as a supply-chain change before the allowlist is advanced.

All `actions/checkout` steps must also set `persist-credentials: false`. The checked-out repository does not need a reusable Git credential for CI, database reproduction, browser tests, monitoring, backups, restore rehearsals, or capacity probes. Removing the credential prevents a later workflow step from silently inheriting repository-token access through local Git configuration.

## Workflow trust boundary

This public repository must not use `pull_request_target` for application build/test execution. That event evaluates workflow code from the base repository while granting access to the base-repository security context and is too easy to misuse with untrusted pull-request content.

Workflows must also not use `permissions: write-all` or `permissions: read-all`. Each workflow should declare only the GitHub token permissions required for its job. Existing production automation that needs a narrow write capability, such as incident issue creation, must keep that permission explicit and scoped.

The repository foundation verifier scans all workflow YAML and fails if these broad-risk patterns are introduced.

## Shell-expression isolation

`workflow_dispatch inputs` and GitHub secrets must not be interpolated directly into `run:` shell source. GitHub expression expansion happens before the runner shell parses the script, so direct interpolation can turn a value into shell syntax if quoting is ever weakened or malformed.

Pass workflow inputs and secrets through a step/job `env:` mapping, then reference the resulting shell variable normally. This rule applies especially to backup reasons, restore object keys/confirmation values, deployment URLs and operational capacity controls. The repository-governance verifier rejects direct `${{ inputs.* }}` and `${{ secrets.* }}` expressions inside shell commands or multiline shell blocks.

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
