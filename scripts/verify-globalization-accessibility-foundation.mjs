import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const provider = read("components/i18n/I18nProvider.tsx");
const brand = read("components/providers/BrandProvider.tsx");
const settings = read("providers/SettingsProvider.tsx");
const switcher = read("components/i18n/LanguageCurrencySwitcher.tsx");
const preferences = read("lib/preferences.ts");
const dictionaries = read("lib/i18n/dictionaries.ts");
const languages = read("lib/languages.ts");
const currencyCore = read("lib/currencyCore.ts");
const currency = read("lib/currency.ts");
const fx = read("lib/fx.ts");
const fxRoute = read("app/api/fx/route.ts");
const layout = read("app/layout.tsx");
const proxy = read("proxy.ts");
const languageRoute = read("app/api/prefs/language/route.ts");
const currencyRoute = read("app/api/prefs/currency/route.ts");
const price = read("components/ui/Price.tsx");
const search = read("components/layout/SearchSuggestions.tsx");
const english = JSON.parse(read("locales/en.json"));
const packageJson = JSON.parse(read("package.json"));
const httpWorkflow = read(".github/workflows/http-authorization.yml");
const browserTest = read("scripts/test-globalization-accessibility-browser.mjs");

assert.match(preferences, /LOCALE_COOKIE = ["']entiz_locale["']/);
assert.match(preferences, /CURRENCY_COOKIE = ["']entiz_currency["']/);
assert.match(preferences, /code: ["']ar["'][^\n]*direction: ["']rtl["']/);
assert.match(dictionaries, /Record<SupportedLocale, Dictionary>/,
  "dictionary registry must be keyed by the canonical locale type");
assert.match(languages, /SUPPORTED_LOCALES/,
  "legacy languages API must project from the canonical locale registry");
assert.doesNotMatch(provider, /NEXT_PUBLIC_SUPPORTED_LOCALES/,
  "runtime environment must not define a second supported-locale registry");
assert.match(provider, /useMemo<Dictionary>\(\(\) => getDictionary\(locale\), \[locale\]\)/,
  "locale dictionary must be derived directly from canonical locale state");
assert.doesNotMatch(provider, /setDict\(/,
  "locale dictionary must not use a second synchronized state machine");
assert.match(provider, /root\.dir = getLocaleDirection\(locale\)/,
  "locale changes must update document direction");
assert.match(provider, /getFxRates\(\)/,
  "canonical preference provider must hydrate safe display FX centrally");
assert.match(provider, /queueMicrotask\(/,
  "legacy localStorage migration must be deferred until after hydration");

assert.match(brand, /useI18n/);
assert.doesNotMatch(brand, /useState/,
  "BrandProvider must remain a compatibility adapter, not an independent state machine");
assert.match(settings, /useI18n/);
assert.doesNotMatch(settings, /localStorage|cookiesGet|useState/,
  "SettingsProvider must not own duplicate locale/currency persistence");
assert.match(switcher, /SUPPORTED_LOCALES/);
assert.doesNotMatch(switcher, /const SUPPORTED_LANGUAGES/,
  "switcher must not create a private language registry");
assert.match(switcher, /useId/);
assert.doesNotMatch(switcher, /id=["'](?:language-select|currency-select)["']/);

assert.match(layout, /dir=\{getLocaleDirection\(initialLocale\)\}/,
  "SSR root direction must match canonical locale");
assert.doesNotMatch(layout, /NEXT_PUBLIC_SUPPORTED_LOCALES/);
assert.match(proxy, /LOCALE_COOKIE/);
assert.match(proxy, /CURRENCY_COOKIE/);
assert.doesNotMatch(proxy, /cookies\.set\(["'](?:locale|currency)["']/,
  "proxy must never write legacy preference names");
assert.match(languageRoute, /LOCALE_COOKIE/);
assert.match(currencyRoute, /CURRENCY_COOKIE/);

assert.match(currencyCore, /getSafeRate/);
assert.match(currencyCore, /FALLBACK_RATES\[currency\]/,
  "missing live rates must use the target fallback rather than rate=1");
assert.match(price, /convertFromBase/);
assert.doesNotMatch(price, /fetch\(["']\/api\/fx/,
  "Price must not own a second FX network/cache state machine");
assert.match(currency, /fetch\(["']\/api\/fx/,
  "canonical currency adapter must own same-origin FX refresh");
assert.match(fx, /FRANKFURTER_ORIGIN = ["']https:\/\/api\.frankfurter\.dev["']/);
assert.match(fx, /redirect: ["']error["']/);
assert.match(fx, /FX_UPSTREAM_TIMEOUT_MS/);
assert.match(fx, /FX_UPSTREAM_MAX_BYTES/);
assert.match(fxRoute, /FALLBACK_RATES/);
assert.doesNotMatch(fxRoute, /error:\s*\([^\n]*message|error\.message/,
  "FX API must not return raw upstream errors");

assert.match(search, /t\(["']search\.placeholder["']/);
assert.match(search, /t\(["']search\.aria["']/);
for (const [key, value] of Object.entries({
  "search.placeholder": english?.search?.placeholder,
  "search.aria": english?.search?.aria,
  "common.language": english?.common?.language,
  "common.currency": english?.common?.currency,
})) {
  assert.equal(typeof value, "string", `${key} must exist in English`);
  assert.ok(value.trim().length >= 4, `${key} must be meaningful`);
  assert.doesNotMatch(value.trim(), /^(?:placeholder|aria|label|text)$/i);
}

assert.match(browserTest, /legacy preference cookies migrate to canonical RTL state/,
  "Chromium must prove legacy-cookie migration and RTL persistence");
assert.match(packageJson.scripts?.["verify:foundation"] || "", /test:globalization-core/,
  "pure globalization policy regressions must run in the permanent foundation gate");
assert.match(httpWorkflow, /test-globalization-accessibility-browser\.mjs/);

process.stdout.write("Globalization, preference and display-FX foundation verification passed\n");