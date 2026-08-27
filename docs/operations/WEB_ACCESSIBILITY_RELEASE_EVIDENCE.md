# Web accessibility release evidence

This file records the minimum evidence expected for the P0 web accessibility release slice.

- Exact PR head must be identified before merge.
- CI must pass lint, typecheck, production build, dependency audit and fresh-database reproduction on that exact head.
- HTTP Authorization Regression must pass real authorization, responsive Chromium and WCAG A/AA accessibility checks on that exact head.
- The exact-head Vercel preview must reach READY.
- Any WCAG violation found by the gate is fixed in product code; axe rules are not disabled or suppressed.
- After merge, the exact production deployment must reach READY, `/api/health` must return 200 with database/storage/operations `ok` and the deployed version matching the merge, and deployment-scoped runtime error/fatal logs must be reviewed.

The critical-flow expansion specifically verifies anonymous, Buyer, Seller, Business/BSM and Admin launch surfaces, along with invalid-field focus recovery, compact mobile viewport behavior, password-reveal keyboard activation and keyboard-driven address suggestions.
