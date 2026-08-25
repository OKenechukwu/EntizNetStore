import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const playwrightNodeModules = process.env.PLAYWRIGHT_NODE_MODULES;
assert.ok(playwrightNodeModules, "PLAYWRIGHT_NODE_MODULES must point to the isolated browser-test dependency directory");
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(playwrightNodeModules, "playwright"));

const origin = (process.env.APP_ORIGIN || "http://127.0.0.1:3000").replace(/\/$/, "");
const outputDir = path.resolve("artifacts/web-responsive");
await mkdir(outputDir, { recursive: true });

const browserErrors = [];

function watchBrowserErrors(page, label) {
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(`[${label}] console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    browserErrors.push(`[${label}] pageerror: ${error.message}`);
  });
}

async function assertNoFrameworkFailure(page, label) {
  const bodyText = await page.locator("body").innerText();
  assert.doesNotMatch(
    bodyText,
    /Application error: a client-side exception has occurred|Internal Server Error|This page could not be found/i,
    `${label}: framework error content rendered`,
  );

  const dialogCount = await page
    .locator('[data-nextjs-dialog-overlay], [data-next-badge-root="true"]')
    .count();
  assert.equal(dialogCount, 0, `${label}: Next.js error overlay rendered`);
}

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert.ok(
    dimensions.scrollWidth <= dimensions.clientWidth + 1,
    `${label}: horizontal overflow (${dimensions.scrollWidth}px > ${dimensions.clientWidth}px)`,
  );
}

async function assertHeaderGeometry(page, label) {
  const geometry = await page.evaluate(() => {
    const isVisible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || "1") > 0 &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const elements = Array.from(
      document.querySelectorAll('header a, header button, header [role="button"]'),
    ).filter(isVisible);

    const items = elements.map((element, index) => {
      const rect = element.getBoundingClientRect();
      const labelText =
        element.getAttribute("aria-label") ||
        element.textContent?.trim().replace(/\s+/g, " ") ||
        `${element.tagName.toLowerCase()}-${index}`;
      return {
        index,
        label: labelText.slice(0, 80),
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    });

    const viewportWidth = document.documentElement.clientWidth;
    const outOfBounds = items.filter(
      (item) => item.left < -1 || item.right > viewportWidth + 1,
    );

    const overlaps = [];
    for (let i = 0; i < elements.length; i += 1) {
      for (let j = i + 1; j < elements.length; j += 1) {
        const firstElement = elements[i];
        const secondElement = elements[j];
        if (firstElement.contains(secondElement) || secondElement.contains(firstElement)) {
          continue;
        }
        const first = items[i];
        const second = items[j];
        const overlapX = Math.min(first.right, second.right) - Math.max(first.left, second.left);
        const overlapY = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
        if (overlapX > 1 && overlapY > 1) {
          overlaps.push({ first: first.label, second: second.label, overlapX, overlapY });
        }
      }
    }

    return { outOfBounds, overlaps };
  });

  assert.deepEqual(geometry.outOfBounds, [], `${label}: header control outside viewport`);
  assert.deepEqual(geometry.overlaps, [], `${label}: overlapping header controls`);
}

async function assertAppsPage(page, label) {
  await page.getByRole("heading", { level: 1, name: "Shop on the web now. Native apps are next." }).waitFor();
  await page.getByRole("link", { name: /Shop on the web/i }).waitFor();

  const iosState = page.locator('[aria-label="iOS App Store release coming soon"]');
  const androidState = page.locator('[aria-label="Google Play release coming soon"]');
  await iosState.waitFor();
  await androidState.waitFor();

  assert.equal(await iosState.evaluate((element) => element.closest("a") === null), true, `${label}: iOS coming-soon state must not be a fake store link`);
  assert.equal(await androidState.evaluate((element) => element.closest("a") === null), true, `${label}: Google Play coming-soon state must not be a fake store link`);

  const robots = await page.locator('meta[name="robots"]').getAttribute("content");
  assert.ok(robots?.toLowerCase().includes("noindex"), `${label}: pre-launch browser build must remain noindex`);

  await assertNoFrameworkFailure(page, label);
  await assertNoHorizontalOverflow(page, label);
  await assertHeaderGeometry(page, label);
}

async function openPage(page, pathname) {
  const response = await page.goto(`${origin}${pathname}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  assert.ok(response, `${pathname}: no HTTP response`);
  assert.ok(response.status() < 400, `${pathname}: HTTP ${response.status()}`);
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
}

const browser = await chromium.launch({ headless: true });
try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watchBrowserErrors(desktop, "desktop");
  await openPage(desktop, "/apps");
  await assertAppsPage(desktop, "desktop /apps");
  const desktopDownload = desktop.getByRole("link", { name: "Download EntizNetStore app" });
  assert.equal(await desktopDownload.isVisible(), true, "desktop: Download App header entry is not visible");
  await desktop.screenshot({ path: path.join(outputDir, "apps-desktop.png"), fullPage: true });
  await desktop.close();

  const tablet = await browser.newPage({ viewport: { width: 820, height: 1180 } });
  watchBrowserErrors(tablet, "tablet");
  await openPage(tablet, "/apps");
  await assertAppsPage(tablet, "tablet /apps");
  const tabletToggle = tablet.getByRole("button", { name: "Toggle menu" });
  assert.equal(await tabletToggle.isVisible(), true, "tablet: compact navigation toggle is not visible");
  await tabletToggle.click();
  const tabletDownload = tablet.getByRole("link", { name: "Download App" });
  await tabletDownload.waitFor();
  await assertNoHorizontalOverflow(tablet, "tablet menu");
  await assertHeaderGeometry(tablet, "tablet menu");
  await tablet.screenshot({ path: path.join(outputDir, "apps-tablet-menu.png"), fullPage: true });
  await tablet.close();

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  watchBrowserErrors(phone, "phone");
  await openPage(phone, "/");
  await assertNoFrameworkFailure(phone, "phone home");
  await assertNoHorizontalOverflow(phone, "phone home");
  await assertHeaderGeometry(phone, "phone home");

  const phoneToggle = phone.getByRole("button", { name: "Toggle menu" });
  const toggleBox = await phoneToggle.boundingBox();
  assert.ok(toggleBox && toggleBox.width >= 44 && toggleBox.height >= 44, "phone: menu toggle touch target is smaller than 44px");
  await phoneToggle.click();

  const phoneDownload = phone.getByRole("link", { name: "Download App" });
  await phoneDownload.waitFor();
  const downloadBox = await phoneDownload.boundingBox();
  assert.ok(downloadBox && downloadBox.height >= 44, "phone: Download App touch target is smaller than 44px");
  await assertNoHorizontalOverflow(phone, "phone menu");
  await assertHeaderGeometry(phone, "phone menu");
  await phone.screenshot({ path: path.join(outputDir, "home-phone-menu.png"), fullPage: true });

  await phoneDownload.click();
  await phone.waitForURL((url) => url.pathname === "/apps", { timeout: 10_000 });
  await assertAppsPage(phone, "phone /apps");
  assert.equal(await phone.getByRole("link", { name: "Download App" }).isVisible().catch(() => false), false, "phone: mobile drawer remained open after navigation");
  await phone.screenshot({ path: path.join(outputDir, "apps-phone.png"), fullPage: true });
  await phone.close();

  assert.deepEqual(browserErrors, [], `Browser errors detected:\n${browserErrors.join("\n")}`);
  console.log("Responsive browser launch regression passed.");
} finally {
  await browser.close();
}
