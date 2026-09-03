import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

const provider = read("components/i18n/I18nProvider.tsx");
const switcher = read("components/i18n/LanguageCurrencySwitcher.tsx");
const search = read("components/layout/SearchSuggestions.tsx");
const english = JSON.parse(read("locales/en.json"));
const packageJson = JSON.parse(read("package.json"));
const httpWorkflow = read(".github/workflows/http-authorization.yml");

assert.match(
  provider,
  /import englishDictionary from ['"]@\/locales\/en\.json['"]/,
  "I18nProvider must have a synchronous English baseline for first render",
);
assert.match(
  provider,
  /useState<Dict>\(ENGLISH_DICTIONARY\)/,
  "I18nProvider must not initialize with an empty dictionary",
);
assert.match(
  provider,
  /t: \(k: string, fallback\?: string\) => string/,
  "i18n translation API must support semantic fallbacks for critical controls",
);
assert.match(
  provider,
  /mergeDictionary\(ENGLISH_DICTIONARY, localized\)/,
  "localized dictionaries must inherit the canonical English baseline",
);
assert.match(
  provider,
  /supported\.has\(requested\) \? requested : ['"]en['"]/,
  "unsupported locale writes must fail closed to English",
);

assert.match(switcher, /useId/,
  "LanguageCurrencySwitcher must use React useId for instance-safe control ids");
assert.doesNotMatch(
  switcher,
  /id=["'](?:language-select|currency-select)["']/,
  "LanguageCurrencySwitcher must never reintroduce fixed responsive ids",
);
assert.match(switcher, /htmlFor=\{languageId\}/,
  "language label must target its instance-specific control");
assert.match(switcher, /htmlFor=\{currencyId\}/,
  "currency label must target its instance-specific control");

assert.match(
  search,
  /t\(["']search\.placeholder["'],\s*SEARCH_PLACEHOLDER_FALLBACK\)/,
  "search placeholder must have a semantic first-render fallback",
);
assert.match(
  search,
  /t\(["']search\.aria["'],\s*SEARCH_ARIA_FALLBACK\)/,
  "search accessible name must have a semantic first-render fallback",
);
assert.doesNotMatch(
  search,
  /console\.error\([^\n]*Search suggestions/i,
  "search provider failures must not leak raw client errors to the console",
);
assert.match(search, /const listboxId = `\$\{instanceId\}-search-suggestions`/,
  "search suggestion listbox ids must be instance-safe");

for (const [key, value] of Object.entries({
  "search.placeholder": english?.search?.placeholder,
  "search.aria": english?.search?.aria,
  "common.language": english?.common?.language,
  "common.currency": english?.common?.currency,
})) {
  assert.equal(typeof value, "string", `${key} must exist in the canonical English dictionary`);
  assert.ok(value.trim().length >= 4, `${key} must be meaningful user-facing copy`);
  assert.doesNotMatch(value.trim(), /^(?:placeholder|aria|label|text)$/i, `${key} cannot be an implementation token`);
}

assert.match(
  packageJson.scripts?.["verify:foundation"] || "",
  /verify-globalization-accessibility-foundation\.mjs/,
  "globalization/accessibility verifier must run in the permanent foundation gate",
);
assert.match(
  httpWorkflow,
  /test-globalization-accessibility-browser\.mjs/,
  "real Chromium globalization/accessibility regression must run in HTTP Authorization CI",
);

process.stdout.write("Globalization and accessibility foundation verification passed\n");
