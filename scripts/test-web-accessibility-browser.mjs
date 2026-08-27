import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const playwrightNodeModules = process.env.PLAYWRIGHT_NODE_MODULES;
assert.ok(
  playwrightNodeModules,
  "PLAYWRIGHT_NODE_MODULES must point to the isolated browser-test dependency directory",
);

const origin = (process.env.APP_ORIGIN || "http://127.0.0.1:3000").replace(/\/$/, "");
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(supabaseUrl, "SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL is required");
assert.ok(anonKey, "SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
assert.ok(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY is required");

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(playwrightNodeModules, "playwright"));
const axeCore = require(path.join(playwrightNodeModules, "axe-core"));
const axeSource = axeCore.source;
assert.ok(typeof axeSource === "string" && axeSource.length > 1_000, "axe-core source was not loaded");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const password = "A11yRegression-Only-2026!";
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const createdUserIds = [];
const browserErrors = [];
const failedResponses = [];

function cookieHeader(cookieJar) {
  return [...cookieJar.entries()].map(([name, entry]) => `${name}=${entry.value}`).join("; ");
}

async function createIdentity(label, appMetadata = {}) {
  const email = `a11y-${label}-${runId}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: appMetadata,
  });
  if (error || !data.user) throw error || new Error(`Unable to create ${label}`);
  createdUserIds.push(data.user.id);

  const cookieJar = new Map();
  const authClient = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return [...cookieJar.entries()].map(([name, entry]) => ({
          name,
          value: entry.value,
        }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieJar.set(name, { value, options: options || {} });
        });
      },
    },
  });

  const { error: signInError } = await authClient.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return {
    id: data.user.id,
    email,
    cookieJar,
    cookie: cookieHeader(cookieJar),
  };
}

async function appFetch(pathname, { cookie, method = "GET", json } = {}) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  if (json !== undefined) headers.set("content-type", "application/json");

  return fetch(`${origin}${pathname}`, {
    method,
    headers,
    body: json !== undefined ? JSON.stringify(json) : undefined,
    redirect: "manual",
  });
}

async function expectStatus(label, response, expected) {
  const payload = await response.clone().text().catch(() => "");
  assert.equal(
    response.status,
    expected,
    `${label}: expected HTTP ${expected}, got ${response.status}; body=${payload.slice(0, 500)}`,
  );
}

function browserCookies(identity) {
  return [...identity.cookieJar.entries()]
    .filter(([, entry]) => entry.value)
    .map(([name, entry]) => ({
      name,
      value: entry.value,
      url: origin,
      httpOnly: Boolean(entry.options?.httpOnly),
      secure: origin.startsWith("https://") && Boolean(entry.options?.secure),
      sameSite:
        entry.options?.sameSite === "strict"
          ? "Strict"
          : entry.options?.sameSite === "none"
            ? "None"
            : "Lax",
    }));
}

function watchBrowserErrors(page, label) {
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      const source = location?.url ? ` source=${location.url}${location.lineNumber != null ? `:${location.lineNumber}` : ""}` : "";
      browserErrors.push(`[${label}] console: ${message.text()}${source}`);
    }
  });
  page.on("pageerror", (error) => {
    browserErrors.push(`[${label}] pageerror: ${error.message}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      const request = response.request();
      failedResponses.push(
        `[${label}] response: ${request.method()} ${response.status()} ${response.url()}`,
      );
    }
  });
  page.on("requestfailed", (request) => {
    failedResponses.push(
      `[${label}] requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText || "unknown error"}`,
    );
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

async function assertSkipNavigation(page, label) {
  const skip = page.getByRole("link", { name: "Skip to content" });
  await skip.waitFor({ state: "attached" });

  await page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
    document.body.setAttribute("tabindex", "-1");
    document.body.focus();
    document.body.removeAttribute("tabindex");
  });
  await page.keyboard.press("Tab");

  assert.equal(
    await skip.evaluate((element) => document.activeElement === element),
    true,
    `${label}: Skip to content must be the first keyboard stop`,
  );

  await page.keyboard.press("Enter");
  await page.waitForTimeout(50);
  assert.equal(
    await page.evaluate(() => document.activeElement?.id),
    "main",
    `${label}: Skip to content did not move keyboard focus to #main`,
  );
}

async function assertAxe(page, label) {
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => {
    const results = await window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
      },
      resultTypes: ["violations"],
    });
    return results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.slice(0, 5).map((node) => ({
        target: node.target,
        failureSummary: node.failureSummary,
      })),
    }));
  });

  assert.deepEqual(
    violations,
    [],
    `${label}: WCAG A/AA violations detected:\n${JSON.stringify(violations, null, 2)}`,
  );
}

async function completeAgeGate(page, label) {
  const confirm = page.getByRole("button", { name: "Yes, I am 18+" });
  const visible = await confirm
    .waitFor({ state: "visible", timeout: 3_000 })
    .then(() => true)
    .catch(() => false);
  if (!visible) return;

  await assertAxe(page, `${label} age gate`);
  await confirm.click();
  await page
    .getByRole("dialog", { name: "Age Verification Required" })
    .waitFor({ state: "detached", timeout: 5_000 });
}

async function openAndAudit(page, pathname, label, expectedPathPrefix = pathname.split("?")[0]) {
  const response = await page.goto(`${origin}${pathname}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  assert.ok(response, `${label}: no HTTP response`);
  assert.ok(response.status() < 400, `${label}: HTTP ${response.status()}`);
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  await completeAgeGate(page, label);

  const finalUrl = new URL(page.url());
  assert.ok(
    finalUrl.pathname.startsWith(expectedPathPrefix),
    `${label}: unexpectedly navigated to ${finalUrl.pathname}`,
  );

  assert.equal(await page.locator("main#main").count(), 1, `${label}: exactly one #main landmark is required`);
  await assertNoFrameworkFailure(page, label);
  await assertNoHorizontalOverflow(page, label);
  await assertSkipNavigation(page, label);
  await assertAxe(page, label);
  process.stdout.write(`ok - ${label} accessibility\n`);
}

async function assertFocusedInViewport(page, locator, label) {
  await locator.waitFor({ state: "visible" });
  const state = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      focused: document.activeElement === element,
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  });
  assert.equal(state.focused, true, `${label}: expected control to hold keyboard focus`);
  assert.ok(
    state.top >= -1 && state.bottom <= state.height + 1 && state.left >= -1 && state.right <= state.width + 1,
    `${label}: focused control is outside the visible viewport (${JSON.stringify(state)})`,
  );
}

async function assertAuthValidationAndKeyboard(page) {
  await page.route("https://photon.komoot.io/api/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        features: [
          { properties: { label: "1 Session Road, Baguio City, Philippines" } },
          { properties: { label: "2 Burnham Park, Baguio City, Philippines" } },
        ],
      }),
    });
  });

  const submit = page.getByRole("button", { name: "Create Account" });
  const email = page.getByLabel("Email address");
  const passwordInput = page.getByLabel("Password", { exact: true });
  const phone = page.getByLabel("Phone number");
  const address = page.getByLabel("Address", { exact: true });
  const formError = page.locator("#auth-form-error");

  await submit.click();
  await formError.waitFor({ state: "visible" });
  assert.equal(await formError.innerText(), "Please enter your email.");
  assert.equal(await email.getAttribute("aria-invalid"), "true");
  await assertFocusedInViewport(page, email, "signup email validation");
  await assertAxe(page, "signup email validation state");

  await email.fill(`validation-${runId}@example.test`);
  await submit.click();
  assert.equal(await formError.innerText(), "Please enter your password.");
  await assertFocusedInViewport(page, passwordInput, "signup password validation");

  await passwordInput.fill(password);
  const showPassword = page.getByRole("button", { name: "Show password" });
  await showPassword.focus();
  await page.keyboard.press("Enter");
  assert.equal(await passwordInput.getAttribute("type"), "text", "password reveal must be keyboard operable");
  const hidePassword = page.getByRole("button", { name: "Hide password" });
  await hidePassword.waitFor({ state: "visible" });
  assert.equal(
    await hidePassword.evaluate((element) => document.activeElement === element),
    true,
    "password reveal should retain focus after keyboard activation",
  );

  await submit.click();
  assert.equal(await formError.innerText(), "Please enter your phone number.");
  await assertFocusedInViewport(page, phone, "signup phone validation");

  await phone.fill("+63 900 000 0000");
  await page.setViewportSize({ width: 390, height: 520 });
  await submit.click();
  assert.equal(await formError.innerText(), "Please enter your address.");
  await assertFocusedInViewport(page, address, "signup address validation with compact visual viewport");

  await address.fill("Bag");
  const listbox = page.getByRole("listbox", { name: "Address suggestions" });
  await listbox.waitFor({ state: "visible" });
  assert.equal(await address.getAttribute("aria-expanded"), "true");
  await page.keyboard.press("ArrowDown");
  assert.equal(
    await address.getAttribute("aria-activedescendant"),
    "auth-address-suggestion-0",
    "ArrowDown must activate the first address suggestion",
  );
  await page.keyboard.press("Enter");
  assert.equal(await address.inputValue(), "1 Session Road, Baguio City, Philippines");
  assert.equal(await address.getAttribute("aria-expanded"), "false");
  await assertFocusedInViewport(page, address, "address suggestion keyboard selection");
  await assertAxe(page, "signup completed keyboard interaction state");

  await page.setViewportSize({ width: 390, height: 844 });
  process.stdout.write("ok - signup validation, compact viewport and address keyboard recovery\n");
}

async function newContext(browser, identity, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport });
  if (identity) {
    const cookies = browserCookies(identity);
    if (cookies.length) await context.addCookies(cookies);
  }
  return context;
}

const buyer = await createIdentity("buyer");
const seller = await createIdentity("seller");
const business = await createIdentity("business");
const adminUser = await createIdentity("admin", { role: "admin" });

await expectStatus(
  "buyer onboarding",
  await appFetch("/api/onboarding/buyer", {
    cookie: buyer.cookie,
    method: "POST",
    json: { display_name: "Accessibility Buyer" },
  }),
  200,
);
await expectStatus(
  "seller onboarding",
  await appFetch("/api/onboarding/seller", {
    cookie: seller.cookie,
    method: "POST",
    json: { storefront_name: "Accessibility Seller", business_type: "individual" },
  }),
  200,
);
await expectStatus(
  "business onboarding",
  await appFetch("/api/onboarding/business", {
    cookie: business.cookie,
    method: "POST",
    json: { display_name: "Accessibility BSM", business_kind: "manufacturer" },
  }),
  200,
);

const browser = await chromium.launch({ headless: true });
try {
  const anonymousContext = await newContext(browser, null, { width: 390, height: 844 });
  const anonymousPage = await anonymousContext.newPage();
  watchBrowserErrors(anonymousPage, "anonymous");
  await openAndAudit(anonymousPage, "/", "anonymous home", "/");
  await openAndAudit(anonymousPage, "/apps", "anonymous apps", "/apps");
  await openAndAudit(anonymousPage, "/auth?mode=signin", "anonymous sign-in", "/auth");
  await openAndAudit(
    anonymousPage,
    "/auth?mode=signup&role=bsm",
    "anonymous BSM sign-up",
    "/auth",
  );
  await assertAuthValidationAndKeyboard(anonymousPage);
  await anonymousContext.close();

  const buyerContext = await newContext(browser, buyer, { width: 390, height: 844 });
  const buyerPage = await buyerContext.newPage();
  watchBrowserErrors(buyerPage, "buyer");
  await openAndAudit(buyerPage, "/cart", "buyer cart", "/cart");
  await openAndAudit(buyerPage, "/checkout", "buyer checkout", "/checkout");
  await openAndAudit(buyerPage, "/dashboard/buyer", "buyer dashboard", "/dashboard/buyer");
  await openAndAudit(
    buyerPage,
    "/dashboard/buyer/orders",
    "buyer order history",
    "/dashboard/buyer/orders",
  );
  await openAndAudit(buyerPage, "/dashboard/profile", "buyer profile", "/dashboard/profile");
  await openAndAudit(buyerPage, "/dashboard/messages", "buyer messages", "/dashboard/messages");
  await buyerContext.close();

  const sellerContext = await newContext(browser, seller, { width: 820, height: 1180 });
  const sellerPage = await sellerContext.newPage();
  watchBrowserErrors(sellerPage, "seller");
  await openAndAudit(sellerPage, "/dashboard/seller", "seller dashboard", "/dashboard/seller");
  await openAndAudit(
    sellerPage,
    "/dashboard/seller/branding",
    "seller branding",
    "/dashboard/seller/branding",
  );
  await openAndAudit(
    sellerPage,
    "/dashboard/seller/analytics",
    "seller analytics",
    "/dashboard/seller/analytics",
  );
  await openAndAudit(
    sellerPage,
    "/dashboard/verification",
    "seller verification",
    "/dashboard/verification",
  );
  await openAndAudit(sellerPage, "/dashboard/store", "seller store", "/dashboard/store");
  await openAndAudit(sellerPage, "/dashboard/messages", "seller messages", "/dashboard/messages");
  await sellerContext.close();

  const businessContext = await newContext(browser, business, { width: 1024, height: 1366 });
  const businessPage = await businessContext.newPage();
  watchBrowserErrors(businessPage, "business");
  await openAndAudit(businessPage, "/dashboard/bsm", "business dashboard", "/dashboard/bsm");
  await openAndAudit(
    businessPage,
    "/dashboard/seller",
    "business seller dashboard",
    "/dashboard/seller",
  );
  await openAndAudit(
    businessPage,
    "/dashboard/seller/branding",
    "business branding",
    "/dashboard/seller/branding",
  );
  await openAndAudit(
    businessPage,
    "/dashboard/verification",
    "business verification",
    "/dashboard/verification",
  );
  await openAndAudit(businessPage, "/dashboard/store", "business store", "/dashboard/store");
  await businessContext.close();

  const adminContext = await newContext(browser, adminUser, { width: 1440, height: 900 });
  const adminPage = await adminContext.newPage();
  watchBrowserErrors(adminPage, "admin");
  const adminRoutes = [
    ["/admin", "admin dashboard"],
    ["/admin/accounts", "admin accounts"],
    ["/admin/products", "admin products"],
    ["/admin/kyc", "admin KYC"],
    ["/admin/orders", "admin orders"],
    ["/admin/refunds", "admin refunds"],
    ["/admin/disputes", "admin disputes"],
    ["/admin/finance", "admin finance"],
    ["/admin/trust-safety", "admin trust and safety"],
    ["/admin/catalog", "admin catalog"],
    ["/admin/communications", "admin communications"],
    ["/admin/audit", "admin audit"],
  ];
  for (const [pathname, label] of adminRoutes) {
    await openAndAudit(adminPage, pathname, label, pathname);
  }
  await adminContext.close();

  assert.deepEqual(
    browserErrors,
    [],
    `Browser errors detected:\n${browserErrors.join("\n")}\n\nFailed HTTP responses observed:\n${failedResponses.join("\n")}`,
  );
  console.log("Authenticated critical-flow web accessibility regression passed.");
} finally {
  await browser.close();
  for (const userId of createdUserIds.reverse()) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
}