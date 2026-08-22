# M2 production promotion record

Status: **PRODUCTION PROMOTION VERIFYING**

PR #8 (`M2: catalogue, storefront and seller operations`) was merged into `main` at commit `de1558d292d2e92fd256796b61e9f9bb47ac2160` after final branch CI #189 passed the complete application, fresh-database, commerce, payment, payout and concurrency regression stack.

All eight M2 forward migrations are already applied and verified on the canonical EntizNetStore Supabase project `kllwwurklumhawfsilpd`.

The validated release-head Vercel preview for commit `b5e51be858b81267710d93ee945cf18f5fc1c605` is READY and serves HTTP 200. After the merge, the normal Vercel production Git webhook did not immediately create a new `main` production deployment; the production alias still pointed to the prior M1 deployment during repeated post-merge checks.

This docs-only `main` commit records that release state and intentionally creates a fresh Git push event without changing application runtime or database behavior. M2 must not be marked fully VERIFIED until the production target advances to an M2-containing `main` commit, the served app returns HTTP 200, and production runtime-error checks are clean.
