import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const playwrightNodeModules = process.env.PLAYWRIGHT_NODE_MODULES;
assert.ok(
  playwrightNodeModules,
  "PLAYWRIGHT_NODE_MODULES must point to the isolated browser-test dependency directory",
);

const origin = (process.env.APP_ORIGIN || "http://127.0.0.1:3000").replace(/\/$/, "");
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(playwrightNodeModules, "playwright"));

function assertMeaningful(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  const normalized = value.trim();
  assert.ok(normalized.length >= 4, `${label} must contain meaningful copy`);
  assert.doesNotMatch(
    normalized,
    /^(?:placeholder|aria|label|text|search placeholder|search aria)$/i,
    `${label} exposed an implementation token: ${normalized}`,
  );
}

async function inspect(page, viewportLabel) {
  const response = await page.goto(`${origin}/`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  assert.ok(response, `${viewportLabel}: homepage returned no response`);
  assert.ok(response.status() < 400, `${viewportLabel}: homepage returned HTTP ${response.status()}`);
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

  const state = await page.evaluate(() => {
    const ids = [...document.querySelectorAll("[id]")]
      .map((element) => element.id)
      .filter(Boolean);
    const counts = ids.reduce((map, id) => {
      map[id] = (map[id] || 0) + 1;
      return map;
    }, {});
    const duplicateIds = Object.entries(counts)
      .filter(([, count]) => count > 1)
      .map(([id, count]) => ({ id, count }));

    const brokenLabels = [...document.querySelectorAll("label[for]")]
      .map((label) => {
        const target = label.getAttribute("for");
        return {
          target,
          matches: target ? document.querySelectorAll(`[id="${CSS.escape(target)}"]`).length : 0,
        };
      })
      .filter((entry) => entry.matches !== 1);

    const search = document.querySelector('input[type="search"][role="combobox"]');
    const languageControls = [...document.querySelectorAll('select[aria-label="Language"]')]
      .map((element) => element.id);
    const currencyControls = [...document.querySelectorAll('select[aria-label="Currency"]')]
      .map((element) => element.id);

    return {
      duplicateIds,
      brokenLabels,
      search: search
        ? {
            placeholder: search.getAttribute("placeholder"),
            ariaLabel: search.getAttribute("aria-label"),
            controls: search.getAttribute("aria-controls"),
          }
        : null,
      languageControls,
      currencyControls,
    };
  });

  assert.deepEqual(
    state.duplicateIds,
    [],
    `${viewportLabel}: duplicate DOM ids detected: ${JSON.stringify(state.duplicateIds)}`,
  );
  assert.deepEqual(
    state.brokenLabels,
    [],
    `${viewportLabel}: labels must resolve to exactly one control: ${JSON.stringify(state.brokenLabels)}`,
  );
  assert.ok(state.search, `${viewportLabel}: canonical desktop search combobox must exist in the DOM`);
  assertMeaningful(state.search.placeholder, `${viewportLabel} search placeholder`);
  assertMeaningful(state.search.ariaLabel, `${viewportLabel} search accessible name`);
  assert.ok(state.search.controls, `${viewportLabel}: search combobox must own an instance-safe listbox id`);

  assert.ok(state.languageControls.length >= 2, `${viewportLabel}: responsive language controls should be rendered`);
  assert.ok(state.currencyControls.length >= 2, `${viewportLabel}: responsive currency controls should be rendered`);
  assert.equal(
    new Set(state.languageControls).size,
    state.languageControls.length,
    `${viewportLabel}: every language switcher instance must have a unique id`,
  );
  assert.equal(
    new Set(state.currencyControls).size,
    state.currencyControls.length,
    `${viewportLabel}: every currency switcher instance must have a unique id`,
  );

  process.stdout.write(`ok - ${viewportLabel} globalization/accessibility DOM invariants\n`);
}

const browser = await chromium.launch({ headless: true });
try {
  for (const [label, viewport] of [
    ["desktop", { width: 1440, height: 900 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await inspect(page, label);
    await context.close();
  }
} finally {
  await browser.close();
}

process.stdout.write("Globalization accessibility browser regression passed\n");
