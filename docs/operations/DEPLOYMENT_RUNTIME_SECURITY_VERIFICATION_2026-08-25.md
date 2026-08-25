# EntizNetStore Deployment Runtime Security Verification — 2026-08-25

This record captures the production runtime, route-inventory and logging checks performed while closing P0-06 deployment-hardening gaps. It is release evidence, not a declaration that every P0-06 launch condition is complete.

## Production identity

- Repository: `OKenechukwu/EntizNetStore`
- Verified `main` merge: `8bc9271c16aaa1ab6342521afe97f8692943270a`
- Vercel project: `entiznetstore`
- Vercel production deployment: `dpl_C1AHp4C643EtzueYP3f4kAokY1Y6`
- Canonical origin: `https://entiznetstore.vercel.app`
- Production readiness: `GET /api/health` returned HTTP 200 with database readiness `ok`
- Grouped Vercel runtime errors in the reviewed 24-hour window: none

## Effective Node.js runtime

The Vercel project setting currently displays Node.js `24.x`, while the repository intentionally declares:

```json
"engines": {
  "node": ">=22 <23"
}
```

Vercel's production build log explicitly confirms that the repository engine declaration overrides the project setting and that **Node.js 22.x is used**. This matches both GitHub CI and the dedicated HTTP Authorization Regression workflow, which use Node 22.

The production-foundation verifier now fails if:

- `package.json` moves away from the canonical Node 22 engine contract;
- the package-lock root engine metadata drifts from the same contract; or
- the main CI / HTTP authorization workflows stop executing on Node 22.

The Vercel dashboard's broader project default therefore does not represent the effective runtime today. Any future Node major upgrade must be deliberate, repository-reviewed and validated across CI, HTTP authorization regression and production deployment evidence.

## Public API route inventory guard

The previous foundation verifier contained a fixed deny-list for known historical development routes. That is now supplemented by a dynamic scan of every `app/api/**/route.*` file.

Production CI rejects route path segments named:

- `debug` / `dev`;
- `test` / `tests`;
- `seed` / `seeds`;
- `mock` / `mocks`;
- `fixture` / `fixtures`;
- `maintenance`;
- `migrate` / `migration` / `migrations`.

This prevents a newly added development, fixture, migration or maintenance endpoint from becoming publicly deployable merely because it was not present in the original static deny-list.

The check is deliberately segment-based rather than substring-based so legitimate production names are not rejected accidentally.

## API logging guard

Every production API route is scanned after comments are removed. CI now rejects direct verbose unstructured logging through:

- `console.log(...)`;
- `console.debug(...)`;
- `console.info(...)`;
- `console.trace(...)`.

This is a regression guard against casually introducing request/body/session diagnostics into production endpoints. Bounded error reporting that is intentionally sanitized remains allowed; existing storage-compensation logging is separately constrained by its behavioral regression so provider objects and secret-like fields are not serialized wholesale.

This control does not replace a future structured logging/telemetry provider. It establishes a safer baseline before one is selected.

## Dependency warning observed during live production build

The reviewed production build completed successfully, but npm emitted peer-resolution warnings because the repository currently installs ESLint 10 while several packages under `eslint-config-next@16.3.1` still advertise peer support through ESLint 9.

This did **not** fail dependency installation, TypeScript, Next.js production build, CI or runtime readiness, so it is not classified as a current production outage. It should be resolved deliberately in dependency maintenance rather than hidden or treated as proof of a runtime failure.

## P0-06 implications

This verification closes the uncertainty around the effective Node runtime and strengthens the route/logging regression baseline. P0-06 remains open for external/operational conditions including:

- reliable production deployment capacity beyond Hobby-plan rate-limit windows;
- an owned production domain with DNS/HTTPS verification;
- final production/preview/staging secret-target isolation review;
- final CSP review after real payment/payout/identity browser providers are selected;
- broader structured telemetry/redaction verification once the production logging destination is finalized.

No payment, payout or EntizNet production signing secret should be provisioned into a preview target merely to satisfy a deployment test.
