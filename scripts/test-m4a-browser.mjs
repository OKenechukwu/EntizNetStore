import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
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

const outputDir = path.resolve("artifacts/web-responsive/m4a");
await mkdir(outputDir, { recursive: true });

const password = "M4A-Browser-Regression-2026!";
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const productTitle = `M4A Browser Wholesale ${runId.slice(-8)}`;
const productSlug = `m4a-browser-wholesale-${runId}`.slice(0, 190);
const createdUserIds = [];
const browserErrors = [];
let productId = null;
let offerId = null;

function cookieHeader(cookieJar) {
  return [...cookieJar.entries()].map(([name, entry]) => `${name}=${entry.value}`).join("; ");
}

async function createIdentity(label) {
  const email = `m4a-browser-${label}-${runId}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error || new Error(`Unable to create ${label}`);
  createdUserIds.push(data.user.id);

  const cookieJar = new Map();
  const authClient = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return [...cookieJar.entries()].map(([name, entry]) => ({ name, value: entry.value }));
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

async function appFetch(pathname, { cookie, method = "GET", json } = {}) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  if (json !== undefined) headers.set("content-type", "application/json");
  return fetch(`${origin}${pathname}`, {
    method,
    headers,
    body: json === undefined ? undefined : JSON.stringify(json),
    redirect: "manual",
  });
}

async function expectStatus(label, response, expected) {
  const body = await response.clone().text().catch(() => "");
  assert.equal(
    response.status,
    expected,
    `${label}: expected HTTP ${expected}, received ${response.status}; body=${body.slice(0, 800)}`,
  );
  process.stdout.write(`ok - ${label} -> ${expected}\n`);
  return body ? JSON.parse(body) : null;
}

async function seedMarketplace(supplier, retailer, ordinaryBuyer) {
  const { error: buyerError } = await admin.from("profiles_buyer").insert([
    { id: supplier.id, display_name: "M4A Browser Supplier Buyer" },
    { id: retailer.id, display_name: "M4A Browser Retailer Buyer" },
    { id: ordinaryBuyer.id, display_name: "M4A Browser Ordinary Buyer" },
  ]);
  if (buyerError) throw buyerError;

  const { error: sellerError } = await admin.from("profiles_seller").insert([
    {
      id: supplier.id,
      storefront_name: "M4A Browser Supplier Store",
      business_type: "business",
      verification_status: "verified",
      return_policy: "M4A browser regression returns policy.",
      shipping_policy: "M4A browser regression shipping policy.",
    },
    {
      id: retailer.id,
      storefront_name: "M4A Browser Retailer Store",
      business_type: "business",
      verification_status: "verified",
      return_policy: "M4A browser regression returns policy.",
      shipping_policy: "M4A browser regression shipping policy.",
    },
  ]);
  if (sellerError) throw sellerError;

  const { error: businessError } = await admin.from("profiles_business").insert([
    {
      id: supplier.id,
      display_name: "M4A Browser Supplier Ltd",
      business_kind: "supplier",
      country: "PH",
      verification_status: "verified",
    },
    {
      id: retailer.id,
      display_name: "M4A Browser Retailer Ltd",
      business_kind: "retailer",
      country: "PH",
      verification_status: "verified",
    },
  ]);
  if (businessError) throw businessError;

  const { data: category, error: categoryError } = await admin
    .from("categories")
    .select("id")
    .eq("is_active", true)
    .limit(1)
    .single();
  if (categoryError || !category) throw categoryError || new Error("No active category for M4A browser fixture");

  const { data: product, error: productError } = await admin
    .from("products")
    .insert({
      seller_id: supplier.id,
      title: productTitle,
      slug: productSlug,
      description: "Disposable M4A authenticated browser regression product.",
      type: "physical",
      status: "draft",
      moderation_status: "not_submitted",
      base_price: 30,
      requires_shipping: false,
      is_taxable: false,
      marketplace_brand: "entiznetstore",
    })
    .select("id")
    .single();
  if (productError || !product) throw productError || new Error("Unable to create M4A browser product");
  productId = product.id;

  const { data: variant, error: variantError } = await admin
    .from("product_variants")
    .insert({
      product_id: product.id,
      title: "Case Unit",
      sku: `M4A-BROWSER-${runId}`.slice(0, 100),
      price: 30,
      track_inventory: true,
      inventory_quantity: 1000,
      inventory_policy: "deny",
      requires_shipping: false,
      is_active: true,
      position: 0,
    })
    .select("id")
    .single();
  if (variantError || !variant) throw variantError || new Error("Unable to create M4A browser variant");

  const onePixelPng =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=";
  const [{ error: categoryLinkError }, { error: mediaError }] = await Promise.all([
    admin.from("product_categories").insert({ product_id: product.id, category_id: category.id }),
    admin.from("product_media").insert({
      product_id: product.id,
      variant_id: variant.id,
      type: "image",
      url: onePixelPng,
      alt_text: "M4A browser wholesale fixture",
      position: 0,
    }),
  ]);
  if (categoryLinkError) throw categoryLinkError;
  if (mediaError) throw mediaError;

  const { error: activationError } = await admin
    .from("products")
    .update({
      moderation_status: "approved",
      status: "active",
      moderated_at: new Date().toISOString(),
    })
    .eq("id", product.id);
  if (activationError) throw activationError;

  return { productId: product.id, variantId: variant.id };
}

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
  const text = await page.locator("body").innerText();
  assert.doesNotMatch(
    text,
    /Application error: a client-side exception has occurred|Internal Server Error|This page could not be found/i,
    `${label}: framework failure rendered`,
  );
  assert.equal(
    await page.locator('[data-nextjs-dialog-overlay], [data-next-badge-root="true"]').count(),
    0,
    `${label}: Next.js error overlay rendered`,
  );
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

async function assertSingleMain(page, label) {
  assert.equal(await page.locator("main#main").count(), 1, `${label}: exactly one global main landmark is required`);
  assert.equal(await page.locator("main main").count(), 0, `${label}: nested main landmark detected`);
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

async function newContext(browser, identity, viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => {
    localStorage.setItem("entiznet-age-verified", "true");
  });
  if (identity) {
    const cookies = browserCookies(identity);
    if (cookies.length) await context.addCookies(cookies);
  }
  return context;
}

async function openPage(page, pathname, label, expectedPathPrefix = pathname) {
  const response = await page.goto(`${origin}${pathname}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  assert.ok(response, `${label}: no HTTP response`);
  assert.ok(response.status() < 400, `${label}: HTTP ${response.status()}`);
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  const finalPath = new URL(page.url()).pathname;
  assert.ok(finalPath.startsWith(expectedPathPrefix), `${label}: unexpectedly navigated to ${finalPath}`);
  await assertNoFrameworkFailure(page, label);
  await assertNoHorizontalOverflow(page, label);
  await assertSingleMain(page, label);
}

async function auditPage(page, pathname, label, expectedPathPrefix = pathname) {
  await openPage(page, pathname, label, expectedPathPrefix);
  await assertAxe(page, label);
  process.stdout.write(`ok - ${label} browser + WCAG\n`);
}

const supplier = await createIdentity("supplier");
const retailer = await createIdentity("retailer");
const ordinaryBuyer = await createIdentity("ordinary-buyer");
const fixture = await seedMarketplace(supplier, retailer, ordinaryBuyer);

const roles = await expectStatus(
  "supplier trading roles",
  await appFetch("/api/bsm/trading-roles", {
    cookie: supplier.cookie,
    method: "PUT",
    json: { roles: ["manufacturer", "supplier", "wholesaler"] },
  }),
  200,
);
assert.deepEqual(roles.roles, ["manufacturer", "supplier", "wholesaler"]);

const createdOffer = await expectStatus(
  "supplier wholesale offer creation",
  await appFetch("/api/bsm/wholesale/offers", {
    cookie: supplier.cookie,
    method: "POST",
    json: {
      productId: fixture.productId,
      variantId: fixture.variantId,
      status: "active",
      minimumOrderQuantity: 12,
      orderMultiple: 5,
      unitLabel: "unit",
      casePackSize: 10,
      leadTimeDays: 7,
      incoterm: "FOB",
      startsAt: null,
      endsAt: null,
      tiers: [
        { minimumQuantity: 12, unitPriceCents: 2000 },
        { minimumQuantity: 52, unitPriceCents: 1800 },
        { minimumQuantity: 102, unitPriceCents: 1600 },
      ],
    },
  }),
  201,
);
offerId = createdOffer.offerId;

const browser = await chromium.launch({ headless: true });
try {
  const anonymousContext = await newContext(browser, null, { width: 390, height: 844 });
  const anonymousPage = await anonymousContext.newPage();
  watchBrowserErrors(anonymousPage, "m4a anonymous");
  await openPage(
    anonymousPage,
    "/dashboard/bsm/marketplace",
    "anonymous BSM marketplace redirect",
    "/auth",
  );
  assert.equal(await anonymousPage.getByText(productTitle, { exact: true }).count(), 0, "anonymous page leaked wholesale product title");
  assert.equal((await anonymousPage.locator("body").innerText()).includes("Quantity pricing"), false, "anonymous page leaked B2B pricing UI");
  await anonymousPage.screenshot({ path: path.join(outputDir, "anonymous-marketplace-redirect.png"), fullPage: true });
  await anonymousContext.close();

  const ordinaryContext = await newContext(browser, ordinaryBuyer, { width: 390, height: 844 });
  const ordinaryPage = await ordinaryContext.newPage();
  watchBrowserErrors(ordinaryPage, "m4a ordinary buyer");
  await openPage(
    ordinaryPage,
    "/dashboard/bsm/marketplace",
    "ordinary Buyer BSM marketplace boundary",
    "/bsm/apply",
  );
  assert.equal(await ordinaryPage.getByText(productTitle, { exact: true }).count(), 0, "ordinary Buyer leaked wholesale product title");
  assert.equal((await ordinaryPage.locator("body").innerText()).includes("Quantity pricing"), false, "ordinary Buyer leaked B2B pricing UI");
  await ordinaryPage.screenshot({ path: path.join(outputDir, "ordinary-buyer-boundary.png"), fullPage: true });
  await ordinaryContext.close();

  const supplierContext = await newContext(browser, supplier, { width: 820, height: 1180 });
  const supplierPage = await supplierContext.newPage();
  watchBrowserErrors(supplierPage, "m4a supplier");
  await auditPage(supplierPage, "/dashboard/bsm", "supplier BSM dashboard");
  await supplierPage.getByRole("heading", { name: "Trading roles" }).waitFor();
  assert.equal(await supplierPage.getByRole("link", { name: "Source inventory" }).isVisible(), true);
  assert.equal(await supplierPage.getByRole("link", { name: "Manage offers" }).isVisible(), true);
  const manufacturerCheckbox = supplierPage.getByRole("checkbox").first();
  assert.ok(await supplierPage.getByText("Manufacturer", { exact: true }).isVisible());
  assert.ok(await manufacturerCheckbox.count());
  await supplierPage.screenshot({ path: path.join(outputDir, "supplier-dashboard.png"), fullPage: true });

  await auditPage(supplierPage, "/dashboard/bsm/wholesale", "supplier wholesale offer manager");
  await supplierPage.getByRole("heading", { name: "Create wholesale offer" }).waitFor();
  const supplierOfferCard = supplierPage.locator("article").filter({ hasText: productTitle }).first();
  await supplierOfferCard.waitFor();
  await supplierPage.getByRole("heading", { name: "Current wholesale offers" }).waitFor();
  assert.ok(await supplierOfferCard.getByText("MOQ 12", { exact: false }).isVisible());
  assert.ok(await supplierOfferCard.getByText("multiple 5", { exact: false }).isVisible());
  await supplierPage.screenshot({ path: path.join(outputDir, "supplier-wholesale-offers.png"), fullPage: true });
  await supplierContext.close();

  const retailerContext = await newContext(browser, retailer, { width: 390, height: 844 });
  const retailerPage = await retailerContext.newPage();
  watchBrowserErrors(retailerPage, "m4a retailer");
  await auditPage(retailerPage, "/dashboard/bsm/marketplace", "retailer wholesale marketplace");
  let retailerOfferCard = retailerPage.locator("article").filter({ hasText: productTitle }).first();
  await retailerOfferCard.waitFor();
  await retailerOfferCard.getByText("Quantity pricing", { exact: true }).waitFor();
  assert.ok(await retailerOfferCard.getByText("12+", { exact: false }).first().isVisible());
  assert.match(await retailerOfferCard.innerText(), /MOQ\s+12/i, "retailer card did not show MOQ 12");
  assert.match(await retailerOfferCard.innerText(), /Multiple\s+5/i, "retailer card did not show order multiple 5");

  const productLink = retailerOfferCard.getByRole("link", { name: productTitle, exact: true });
  assert.equal(await productLink.getAttribute("href"), `/products/${productSlug}`, "wholesale card did not use canonical product route");
  await Promise.all([
    retailerPage.waitForURL((url) => url.pathname === `/products/${productSlug}`, { timeout: 10_000 }),
    productLink.click(),
  ]);
  await retailerPage.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  await assertNoFrameworkFailure(retailerPage, "retailer canonical product navigation");
  await assertNoHorizontalOverflow(retailerPage, "retailer canonical product navigation");
  await assertSingleMain(retailerPage, "retailer canonical product navigation");
  await assertAxe(retailerPage, "retailer canonical product navigation");
  assert.ok(await retailerPage.getByText(productTitle, { exact: true }).first().isVisible(), "canonical product page did not render sourced product");
  process.stdout.write("ok - retailer wholesale product link resolves canonical product route + WCAG\n");

  await auditPage(retailerPage, "/dashboard/bsm/marketplace", "retailer wholesale marketplace after product navigation");
  retailerOfferCard = retailerPage.locator("article").filter({ hasText: productTitle }).first();
  await retailerOfferCard.waitFor();

  const quantityInput = retailerOfferCard.getByLabel("Order quantity");
  await quantityInput.fill("52");
  await quantityInput.blur();
  await retailerOfferCard.getByText("52+", { exact: false }).first().waitFor();

  const escapedTitle = productTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const increase = retailerOfferCard.getByRole("button", { name: new RegExp(`Increase ${escapedTitle} quantity by 5`) });
  const decrease = retailerOfferCard.getByRole("button", { name: new RegExp(`Decrease ${escapedTitle} quantity by 5`) });
  for (const [control, label] of [[increase, "increase"], [decrease, "decrease"]]) {
    const box = await control.boundingBox();
    assert.ok(box && box.width >= 44 && box.height >= 44, `retailer ${label} quantity control is smaller than 44px`);
  }

  await retailerOfferCard.getByRole("button", { name: "Add wholesale" }).click();
  await retailerPage.getByRole("status").filter({ hasText: productTitle }).waitFor();
  await assertNoHorizontalOverflow(retailerPage, "retailer marketplace after cart mutation");
  await assertAxe(retailerPage, "retailer marketplace after cart mutation");
  await retailerPage.screenshot({ path: path.join(outputDir, "retailer-marketplace-added.png"), fullPage: true });

  await auditPage(retailerPage, "/cart", "retailer wholesale cart");
  await retailerPage.getByText(productTitle, { exact: true }).waitFor();
  await retailerPage.getByText("Wholesale", { exact: true }).waitFor();
  await retailerPage.getByText("MOQ:", { exact: false }).waitFor();
  await retailerPage.getByText("Applied tier:", { exact: false }).waitFor();
  const cartText = await retailerPage.locator("body").innerText();
  assert.match(cartText, /MOQ:\s*12/i, "wholesale cart did not preserve MOQ 12");
  assert.match(cartText, /Applied tier:\s*52\+/i, "wholesale cart did not preserve the applied 52+ tier");
  assert.match(cartText, /Order multiple:\s*5/i, "wholesale cart did not preserve the order multiple");
  await retailerPage.screenshot({ path: path.join(outputDir, "retailer-wholesale-cart.png"), fullPage: true });
  await retailerContext.close();

  assert.deepEqual(browserErrors, [], `M4A browser errors detected:\n${browserErrors.join("\n")}`);
  process.stdout.write("M4A authenticated browser regression passed\n");
} finally {
  await browser.close();

  try {
    if (retailer?.id) {
      const { data: carts } = await admin.from("carts").select("id").eq("buyer_id", retailer.id);
      const cartIds = (carts || []).map((cart) => cart.id);
      if (cartIds.length) await admin.from("carts").delete().in("id", cartIds);
    }
  } catch {
    // Disposable local verification database; teardown must not mask the real assertion.
  }

  try {
    if (offerId) await admin.from("wholesale_offers").delete().eq("id", offerId);
  } catch {
    // Best-effort cleanup.
  }
  try {
    if (productId) await admin.from("products").delete().eq("id", productId);
  } catch {
    // Best-effort cleanup.
  }
  for (const id of createdUserIds.reverse()) {
    try {
      await admin.auth.admin.deleteUser(id);
    } catch {
      // Best-effort cleanup.
    }
  }
}