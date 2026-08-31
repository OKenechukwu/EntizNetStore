# EntizNetStore Public Web Launch Interlock

Last reviewed: **2026-08-31**

This control exists to prevent an accidental environment-variable edit, preview deployment or partial release configuration from making EntizNetStore discoverable by search crawlers before the public Web V1 launch review is complete.

It is a defense-in-depth indexing control. It is **not** authorization, it does not hide publicly reachable URLs from someone who already knows them, and it does not replace the P0 launch gates in `LAUNCH_BLOCKERS.md`.

## Activation contract

Public indexing is enabled only when all three conditions are true at the same time:

1. Vercel reports `VERCEL_ENV=production`;
2. `SITE_INDEXING_ENABLED=true`;
3. `PUBLIC_LAUNCH_CONFIRMATION=ENTIZNETSTORE_PUBLIC_WEB_V1`.

The confirmation value is deliberately exact and case-sensitive. It is not a secret. Preview and development deployments remain non-indexable even if the two launch variables are copied into those environments because `VERCEL_ENV` is not `production`.

The committed `.env.example` stays fail-closed:

```text
SITE_INDEXING_ENABLED=false
PUBLIC_LAUNCH_CONFIRMATION=NOT_CONFIRMED
```

Do not put the active confirmation in shared preview/staging configuration as a shortcut.

## Defense layers

### Root metadata

`app/layout.tsx` uses the canonical launch helper. Before activation it emits `noindex`, `nofollow` and `noarchive` metadata.

### HTTP response header

`proxy.ts` emits:

```text
X-Robots-Tag: noindex, nofollow, noarchive
```

for every matched application page while the launch gate is blocked. After launch it continues emitting the header for sensitive/private route families.

### robots.txt

Before launch, `/robots.txt` returns a global crawl refusal:

```text
User-Agent: *
Disallow: /
```

After intentional activation, public catalogue/storefront routes may be crawled while private/sensitive families remain disallowed, including API, Admin, Dashboard, Auth, Checkout, Cart, Wishlist, Messages, Notifications, Seller Dashboard and Internal routes.

`robots.txt` is advisory to compliant crawlers and is never treated as an access-control boundary.

### Health/readiness signal

`/api/health` reports only:

```json
{"launchGates":{"indexing":"blocked"}}
```

or `enabled`. It does not expose environment values or explain which activation condition is missing.

### Release smoke

The canonical production smoke checks consistency between the bounded health signal, the root `X-Robots-Tag` behavior and `/robots.txt`. This protects against a release where one indexing layer drifts from the others.

## Private route policy after launch

The canonical application policy in `lib/launch/publicIndexing.ts` keeps these route families non-indexable even after the public launch switch is enabled:

- `/api`;
- `/admin`;
- `/dashboard`;
- `/auth`;
- `/checkout`;
- `/cart`;
- `/wishlist`;
- `/messages`;
- `/notifications`;
- `/seller/dashboard`;
- `/internal`.

Authorization/RLS remains the real protection for authenticated/private resources.

## Launch-day procedure

Only perform the indexing activation after the owner/release reviewer has confirmed every applicable P0 launch blocker has been closed or explicitly accepted through the launch process.

1. Confirm the intended `main` SHA is green in CI and the authenticated HTTP/Chromium/WCAG gate.
2. Confirm the exact SHA is deployed and `/api/health` is healthy.
3. Confirm backup/restore, scanner, payment/payout, EntizNet signing, observability, domain, repository protection and final policy/provider requirements are in their approved launch state.
4. Confirm the canonical owned domain is serving the exact release and the final security/CSP review is complete.
5. Set production-only `SITE_INDEXING_ENABLED=true`.
6. Set production-only `PUBLIC_LAUNCH_CONFIRMATION=ENTIZNETSTORE_PUBLIC_WEB_V1`.
7. Redeploy production intentionally.
8. Verify `/api/health.launchGates.indexing=enabled`.
9. Run the exact-SHA production HTTP smoke.
10. Verify public pages no longer carry the prelaunch `X-Robots-Tag: noindex` header while private route families still do.
11. Verify `/robots.txt` no longer has `Disallow: /` and still disallows private route families.
12. Review Vercel runtime errors/logs and record the release evidence.

Do not activate indexing merely because the application is technically reachable or because a preview looks complete.

## Emergency disable

If the launch needs to be pulled back from discovery without destroying data or rolling back the application:

1. set `SITE_INDEXING_ENABLED=false` **or** set `PUBLIC_LAUNCH_CONFIRMATION=NOT_CONFIRMED` in production;
2. redeploy production;
3. verify `/api/health.launchGates.indexing=blocked`;
4. verify root `X-Robots-Tag` is `noindex, nofollow, noarchive`;
5. verify `/robots.txt` contains `Disallow: /`;
6. run the production smoke and record the incident/change.

This does not remove content already indexed by a search engine and does not replace an application rollback or incident response when those are required.
