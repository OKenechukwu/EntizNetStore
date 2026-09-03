# Globalization Preferences and Display FX

## Authority boundaries

EntizNetStore has one canonical client/server preference contract:

- locale cookie/storage: `entiz_locale`
- display currency cookie/storage: `entiz_currency`
- locale registry: `lib/preferences.ts`
- currency registry and monetary display math: `lib/currencyCore.ts`

Legacy `locale`, `language`, and `currency` values are read only for migration. New writes must use the canonical `entiz_*` keys and remove legacy state.

`I18nProvider` owns active locale, display currency, dictionary and FX state. `BrandProvider`, `SettingsProvider`, and `CurrencyProvider` are compatibility adapters and must not create independent preference state machines.

## Locale behavior

Every supported locale is backed by a repository JSON dictionary and synchronously merged over the canonical English baseline. The initial server frame therefore has meaningful copy without an async empty-dictionary state. `html.lang`, `html.dir`, `data-locale`, and `data-currency` track canonical state. Arabic is currently the RTL launch locale.

Adding a locale requires adding it to `SUPPORTED_LOCALES`, adding its JSON dictionary, and passing the globalization foundation/browser gates. Environment variables do not redefine the supported-locale set.

## Display FX versus commerce authority

USD remains the canonical product/order/payment settlement authority for V1. FX is presentation-only. Client-selected display currency and live display rates must never rewrite checkout quotes, order ledgers, payment intents, refunds, seller payouts, or immutable financial snapshots.

The server-only `/api/fx` adapter uses Frankfurter v2 at the exact HTTPS origin `https://api.frankfurter.dev`. The upstream request has a five-second timeout, refuses redirects, accepts JSON only, bounds the response to 64 KiB, validates every configured quote, requires a USD base, and rejects incomplete or invalid rate sets.

Browser code calls only same-origin `/api/fx`; CSP does not need third-party FX egress. CI uses the complete static fallback to keep security/browser tests deterministic; the external adapter is covered by pure policy/static boundary tests.

## Failure behavior

A complete validated cached table may be used when the live provider is unavailable. Otherwise the app uses the complete static fallback table. Missing target rates never imply `rate = 1`; this prevents an unconverted USD value from being displayed under another currency symbol.

Live-provider errors are reduced to bounded diagnostic codes and are not returned to clients. A display-FX outage must not make browsing or checkout unavailable.

## Pre-user gates

The permanent release chain includes:

1. pure locale/currency/FX policy tests;
2. static single-source/preference/provider boundary verification;
3. production TypeScript/build checks;
4. Chromium duplicate-ID, semantic-copy, legacy-cookie migration, RTL and persistence tests;
5. existing WCAG and authorization suites;
6. exact Vercel Preview before merge;
7. production root/health/header/log proof after merge.
