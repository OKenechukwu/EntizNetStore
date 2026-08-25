# Route and runtime security verification — 2026-08-25

## Scope

This verification closes a code-addressable portion of P0-06: accidental development/maintenance UI exposure and non-deterministic Next.js 16 build configuration.

## Removed production surfaces

### `/admin/i18n/seed`

The repository still contained a legacy client page that asked an operator to paste `ADMIN_SEED_TOKEN` into the browser and attempted to call `/api/i18n/seed-all`.

That API route is already prohibited by the production-foundation guard, so the page was dead. More importantly, retaining browser-secret tooling under a production route creates needless secret-handling and route-inventory risk.

The page is removed rather than re-secured. Production translation/content operations must use an explicit authenticated server/Admin workflow if they are reintroduced later.

### `/internal/upload-product-image`

The repository also contained a development utility reachable under `/internal/upload-product-image`. Its layout returned 404 in production unless `INTERNAL_OPEN=true`, meaning a deployment environment variable could expose it publicly.

The utility bypassed the canonical Seller media flow by:

- using the browser Supabase client directly;
- uploading to legacy bucket `store-products` rather than canonical `product-media`;
- deriving object paths from a selected product id;
- directly updating `products.images` in the browser;
- relying on database/Storage policy behavior rather than the validated Seller upload route.

The entire `app/internal` surface is removed. Product media must flow through `/api/seller/product-media/upload` and the canonical Seller product workflow.

## Next.js 16 request hook

Next.js 16 deprecates the root `middleware.ts` convention in favor of `proxy.ts`. The existing middleware only seeds locale/currency cookies, so it was migrated without adding authorization responsibilities:

- `middleware.ts` removed;
- `proxy.ts` added;
- named export is `proxy`;
- existing matcher and cookie behavior are preserved;
- authorization continues to be enforced in routes/RLS rather than relying on Proxy.

## Deterministic TypeScript build configuration

Before this change, `next build` rewrote `tsconfig.json` on every clean build. The repository now commits the settings Next 16 requires/suggests for the current app:

- `target: ES2017`;
- `jsx: react-jsx`;
- `.next/dev/types/**/*.ts` included alongside `.next/types/**/*.ts`.

This makes the repository configuration match the production compiler contract instead of relying on an implicit build-time edit.

This change does **not** turn on global TypeScript strict mode. `strict: false` with `strictNullChecks: true` remains the current explicit legacy contract and should be tightened module-by-module rather than through an unsafe whole-application flip.

## ESLint configuration cleanup

The obsolete `.eslintrc.json` left behind from the pre-flat-config setup is removed. `eslint.config.mjs` is now the only ESLint configuration source.

## Permanent guards

`scripts/verify-route-runtime-foundation.mjs` is chained into `npm run verify:foundation`. It fails if any of the following return:

- `.eslintrc.json`;
- `middleware.ts`;
- `app/admin/i18n/seed`;
- `app/internal`;
- `INTERNAL_OPEN` in runtime source;
- `ADMIN_SEED_TOKEN` in runtime source;
- legacy `store-products` bucket usage in runtime source;
- `/api/i18n/seed-all` references in runtime source.

It also verifies the canonical `proxy.ts` cookie/matcher contract and the committed Next 16 TypeScript settings.

## Verification gate

Before merge:

1. production foundation + lint ratchet must pass;
2. typecheck and production build must pass;
3. the build must no longer warn that `middleware` is deprecated;
4. the build must no longer report that it rewrote `tsconfig.json`;
5. fresh-Supabase M1/M2/M3/commerce/payment/payout/concurrency regressions must pass;
6. the real HTTP authorization regression must pass;
7. exact-head Vercel preview and `/api/health` must be healthy;
8. build route inventory must no longer contain `/admin/i18n/seed` or `/internal/upload-product-image`.

## Remaining route/runtime work

This change is intentionally scoped. Other Next/build warnings discovered during verification—such as any page still explicitly selecting the deprecated Edge Runtime—must be traced to their owning route and removed or migrated in a separate verified change rather than bundled blindly into this cleanup.
