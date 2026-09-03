import assert from "node:assert/strict";
import test from "node:test";
import { buildRatesUrl, parseRateRows, FxPolicyError } from "../lib/fxCore.ts";
import { SUPPORTED_CURRENCIES } from "../lib/currencyCore.ts";

function rows() {
  return SUPPORTED_CURRENCIES
    .filter((code) => code !== "USD")
    .map((quote, index) => ({ date: "2026-09-03", base: "USD", quote, rate: index + 0.5 }));
}

test("FX provider URL is exact HTTPS v2 origin with bounded quote list", () => {
  const url = new URL(buildRatesUrl("https://api.frankfurter.dev", "USD", ["EUR", "GBP"]));
  assert.equal(url.origin, "https://api.frankfurter.dev");
  assert.equal(url.pathname, "/v2/rates");
  assert.equal(url.searchParams.get("base"), "USD");
  assert.equal(url.searchParams.get("quotes"), "EUR,GBP");
  assert.throws(() => buildRatesUrl("http://api.frankfurter.dev", "USD", ["EUR"]), FxPolicyError);
});

test("complete Frankfurter v2 rows reshape to a USD-anchored rate table", () => {
  const parsed = parseRateRows(rows(), "USD", SUPPORTED_CURRENCIES);
  assert.equal(parsed.rates.USD, 1);
  assert.equal(parsed.rates.EUR, 0.5);
  assert.equal(parsed.asOf, "2026-09-03");
});

test("partial, duplicate, wrong-base and invalid-rate payloads fail closed", () => {
  assert.throws(() => parseRateRows(rows().slice(0, -1), "USD", SUPPORTED_CURRENCIES), /incomplete_rates/);
  assert.throws(() => parseRateRows([...rows(), rows()[0]], "USD", SUPPORTED_CURRENCIES), /duplicate_quote/);
  assert.throws(() => parseRateRows(rows().map((row, index) => index ? row : { ...row, base: "EUR" }), "USD", SUPPORTED_CURRENCIES), /unexpected_base/);
  assert.throws(() => parseRateRows(rows().map((row, index) => index ? row : { ...row, rate: 0 }), "USD", SUPPORTED_CURRENCIES), /invalid_rate/);
});
