import assert from "node:assert/strict";
import test from "node:test";
import {
  SUPPORTED_LOCALES,
  getLocaleDirection,
  parseLocale,
  toLocale,
} from "../lib/preferences.ts";
import {
  FALLBACK_RATES,
  SUPPORTED_CURRENCIES,
  coerceFxRates,
  convertFromBase,
  getSafeRate,
  toCurrencyCode,
} from "../lib/currencyCore.ts";

test("locale registry is canonical, bounded and region tolerant", () => {
  assert.equal(new Set(SUPPORTED_LOCALES.map((locale) => locale.code)).size, SUPPORTED_LOCALES.length);
  assert.equal(parseLocale("ar-SA"), "ar");
  assert.equal(parseLocale("pt_BR"), "pt");
  assert.equal(parseLocale("xx"), null);
  assert.equal(toLocale("xx"), "en");
  assert.equal(getLocaleDirection("ar"), "rtl");
  assert.equal(getLocaleDirection("de"), "ltr");
});

test("currency registry normalizes unsupported values fail closed to USD", () => {
  assert.equal(new Set(SUPPORTED_CURRENCIES).size, SUPPORTED_CURRENCIES.length);
  assert.equal(toCurrencyCode("php"), "PHP");
  assert.equal(toCurrencyCode("ABC"), "USD");
});

test("FX tables are accepted only when complete, positive and USD anchored", () => {
  assert.deepEqual(coerceFxRates(FALLBACK_RATES), FALLBACK_RATES);
  assert.equal(coerceFxRates({ USD: 1, EUR: 0.9 }), null);
  assert.equal(coerceFxRates({ ...FALLBACK_RATES, EUR: 0 }), null);
  assert.equal(coerceFxRates({ ...FALLBACK_RATES, USD: 1.1 }), null);
});

test("missing target rates never relabel the original USD amount", () => {
  const partial = { USD: 1 } as const;
  assert.equal(getSafeRate("EUR", partial), FALLBACK_RATES.EUR);
  assert.equal(convertFromBase(100, "EUR", partial), Math.round(100 * FALLBACK_RATES.EUR * 100) / 100);
  assert.notEqual(convertFromBase(100, "EUR", partial), 100);
});

test("valid supplied rates override display fallback without changing base authority", () => {
  const custom = { ...FALLBACK_RATES, EUR: 0.5 };
  assert.equal(convertFromBase(100, "USD", custom), 100);
  assert.equal(convertFromBase(100, "EUR", custom), 50);
});
