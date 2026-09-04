# Main Branch Direct-Write Evidence — 2026-09-05

During post-PR #67 production evidence recording, GitHub accepted a direct contents write to `main` because branch protection/rulesets remain disabled.

This was a documentation-only change, but it proves the P0-06 governance risk is live: repository policy currently does not enforce the intended pull-request + mandatory-status-check release path.

Do not use direct `main` writes as a normal engineering mechanism. Subsequent development returns to feature branches and pull requests. Activate an enforceable GitHub ruleset/branch-protection policy as defined in `MAIN_BRANCH_PROTECTION_GATE.md` before public launch.
