import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const playwrightNodeModules = process.env.PLAYWRIGHT_NODE_MODULES;
assert.ok(playwrightNodeModules, "PLAYWRIGHT_NODE_MODULES must point to isolated browser tooling");
const origin = (process.env.APP_ORIGIN || "http://127.0.0.1:3000").replace(/\/$/, "");
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(playwrightNodeModules, "playwright"));

function assertMeaningful(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  const normalized = value.trim();
  assert.ok(normalized.length >= 4, `${label} must contain meaningful copy`);
  assert.doesNotMatch(normalized, /^(?:placeholder|aria|label|text|search placeholder|search aria)$/i);
}

async function inspect(page, viewportLabel) {
  const response = await page.goto(`${origin}/`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  assert.ok(response && response.status() < 400, `${viewportLabel}: homepage must load`);
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  const state = await page.evaluate(() => {
    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id).filter(Boolean);
    const counts = ids.reduce((map, id) => ({ ...map, [id]: (map[id] || 0) + 1 }), {});
    const duplicateIds = Object.entries(counts).filter(([, count]) => count > 1);
    const brokenLabels = [...document.querySelectorAll("label[for]")]
      .map((label) => {
        const target = label.getAttribute("for");
        return { target, matches: target ? document.querySelectorAll(`[id="${CSS.escape(target)}"]`).length : 0 };
      })
      .filter((entry) => entry.matches !== 1);
    const search = document.querySelector('input[type="search"][role="combobox"]');
    return {
      duplicateIds,
      brokenLabels,
      search: search ? { placeholder: search.getAttribute("placeholder"), ariaLabel: search.getAttribute("aria-label"), controls: search.getAttribute("aria-controls") } : null,
      languageControls: [...document.querySelectorAll('select[id$="-language"]')].map((element) => element.id),
      currencyControls: [...document.querySelectorAll('select[id$="-currency"]')].map((element) => element.id),
    };
  });
  assert.deepEqual(state.duplicateIds, [], `${viewportLabel}: duplicate DOM ids detected`);
  assert.deepEqual(state.brokenLabels, [], `${viewportLabel}: labels must resolve exactly once`);
  assert.ok(state.search, `${viewportLabel}: search combobox must exist`);
  assertMeaningful(state.search.placeholder, `${viewportLabel} search placeholder`);
  assertMeaningful(state.search.ariaLabel, `${viewportLabel} search accessible name`);
  assert.ok(state.search.controls, `${viewportLabel}: search must own a listbox id`);
  assert.ok(state.languageControls.length >= 2);
  assert.ok(state.currencyControls.length >= 2);
  assert.equal(new Set(state.languageControls).size, state.languageControls.length);
  assert.equal(new Set(state.currencyControls).size, state.currencyControls.length);
  process.stdout.write(`ok - ${viewportLabel} globalization/accessibility DOM invariants\n`);
}

async function inspectPreferenceMigration(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addCookies([
    { name: "locale", value: "ar", url: origin },
    { name: "currency", value: "PHP", url: origin },
  ]);
  const page = await context.newPage();
  const response = await page.goto(`${origin}/`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  assert.ok(response && response.status() < 400);
  await page.waitForFunction(() => document.documentElement.lang === "ar" && document.documentElement.dir === "rtl");
  let state = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    currency: document.documentElement.dataset.currency,
    cookies: document.cookie,
  }));
  assert.deepEqual({ lang: state.lang, dir: state.dir, currency: state.currency }, { lang: "ar", dir: "rtl", currency: "PHP" });
  assert.match(state.cookies, /(?:^|;\s*)entiz_locale=ar(?:;|$)/);
  assert.match(state.cookies, /(?:^|;\s*)entiz_currency=PHP(?:;|$)/);
  assert.doesNotMatch(state.cookies, /(?:^|;\s*)locale=/);
  assert.doesNotMatch(state.cookies, /(?:^|;\s*)currency=/);

  await page.locator('select[id$="-language"]').first().selectOption("de");
  await page.locator('select[id$="-currency"]').first().selectOption("EUR");
  await page.waitForFunction(() => document.documentElement.lang === "de" && document.documentElement.dir === "ltr" && document.documentElement.dataset.currency === "EUR");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.documentElement.lang === "de" && document.documentElement.dataset.currency === "EUR");
  state = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir, currency: document.documentElement.dataset.currency }));
  assert.deepEqual(state, { lang: "de", dir: "ltr", currency: "EUR" });
  await context.close();
  process.stdout.write("ok - legacy preference cookies migrate to canonical RTL state and persist\n");
}

const browser = await chromium.launch({ headless: true });
try {
  for (const [label, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await inspect(page, label);
    await context.close();
  }
  await inspectPreferenceMigration(browser);
} finally {
  await browser.close();
}

process.stdout.write("Globalization accessibility browser regression passed\n");
