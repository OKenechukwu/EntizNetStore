import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const playwrightNodeModules = process.env.PLAYWRIGHT_NODE_MODULES;
assert.ok(playwrightNodeModules, "PLAYWRIGHT_NODE_MODULES is required");
const origin = (process.env.APP_ORIGIN || "http://127.0.0.1:3000").replace(/\/$/, "");
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(supabaseUrl && anonKey && serviceRoleKey, "Supabase browser-test environment is incomplete");

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(playwrightNodeModules, "playwright"));
const axeSource = require(path.join(playwrightNodeModules, "axe-core")).source;
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = "Fulfillment-Browser-Regression-2026!";
const orderNumber = `ENS-BROWSER-${runId.slice(-10).toUpperCase()}`;
const browserErrors = [];

function cookieHeader(cookieJar) {
  return [...cookieJar.entries()].map(([name, entry]) => `${name}=${entry.value}`).join("; ");
}

async function createIdentity(label) {
  const email = `fulfillment-browser-${label}-${runId}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error || new Error(`Unable to create ${label}`);
  const cookieJar = new Map();
  const authClient = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => [...cookieJar.entries()].map(([name, entry]) => ({ name, value: entry.value })),
      setAll: (cookies) => cookies.forEach(({ name, value, options }) => cookieJar.set(name, { value, options: options || {} })),
    },
  });
  const { error: signInError } = await authClient.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, cookieJar, cookie: cookieHeader(cookieJar) };
}

function browserCookies(identity) {
  return [...identity.cookieJar.entries()].filter(([, entry]) => entry.value).map(([name, entry]) => ({
    name,
    value: entry.value,
    url: origin,
    httpOnly: Boolean(entry.options?.httpOnly),
    secure: origin.startsWith("https://") && Boolean(entry.options?.secure),
    sameSite: entry.options?.sameSite === "strict" ? "Strict" : entry.options?.sameSite === "none" ? "None" : "Lax",
  }));
}

async function newContext(browser, identity, viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => localStorage.setItem("entiznet-age-verified", "true"));
  const cookies = browserCookies(identity);
  if (cookies.length) await context.addCookies(cookies);
  return context;
}

function watch(page, label) {
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`[${label}] console: ${message.text()}`);
  });
  page.on("pageerror", (error) => browserErrors.push(`[${label}] pageerror: ${error.message}`));
}

async function assertAxe(page, label) {
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => {
    const results = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
      resultTypes: ["violations"],
    });
    return results.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 4).map((n) => n.target) }));
  });
  assert.deepEqual(violations, [], `${label}: WCAG violations\n${JSON.stringify(violations, null, 2)}`);
}

async function open(page, pathname, label) {
  const response = await page.goto(`${origin}${pathname}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  assert.ok(response && response.status() < 400, `${label}: page failed to load`);
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  assert.equal(await page.locator("main#main").count(), 1, `${label}: global main landmark missing`);
  assert.equal(await page.locator("main main").count(), 0, `${label}: nested main landmark`);
  const body = await page.locator("body").innerText();
  assert.doesNotMatch(body, /Application error|Internal Server Error/i, `${label}: framework error rendered`);
}

const buyer = await createIdentity("buyer");
const seller = await createIdentity("seller");

const { error: buyerProfileError } = await admin.from("profiles_buyer").insert({ id: buyer.id, display_name: "Browser Fulfillment Buyer" });
if (buyerProfileError) throw buyerProfileError;
const { error: sellerProfileError } = await admin.from("profiles_seller").insert({
  id: seller.id,
  storefront_name: "Browser Fulfillment Seller",
  store_slug: `browser-fulfillment-${runId}`.slice(0, 120),
  verification_status: "verified",
});
if (sellerProfileError) throw sellerProfileError;

const { data: order, error: orderError } = await admin.from("orders").insert({
  order_number: orderNumber,
  buyer_id: buyer.id,
  seller_id: seller.id,
  status: "confirmed",
  subtotal_cents: 4200,
  total_cents: 4200,
  payment_status: "paid",
  fulfillment_status: "unfulfilled",
  shipping_address: { country: "US", line1: "1 Browser Test" },
}).select("id").single();
if (orderError || !order) throw orderError || new Error("Unable to create fulfillment browser order");

const { error: itemError } = await admin.from("order_items").insert({
  order_id: order.id,
  quantity: 1,
  price_cents: 4200,
  total_cents: 4200,
  product_title: "Browser Fulfillment Item",
  requires_shipping: true,
});
if (itemError) throw itemError;
const { error: escrowError } = await admin.from("escrow_transactions").insert({
  order_id: order.id,
  seller_id: seller.id,
  amount_cents: 3780,
  status: "held",
});
if (escrowError) throw escrowError;

const browser = await chromium.launch({ headless: true });
try {
  const sellerContext = await newContext(browser, seller, { width: 820, height: 1100 });
  const sellerPage = await sellerContext.newPage();
  watch(sellerPage, "fulfillment seller");
  await open(sellerPage, "/dashboard/orders", "seller orders");
  await sellerPage.getByText(orderNumber, { exact: true }).waitFor();
  await sellerPage.getByRole("button", { name: "Start processing" }).click();
  await sellerPage.getByRole("button", { name: "Mark shipped" }).waitFor();
  await sellerPage.getByLabel("Shipping carrier").fill("Browser Carrier");
  await sellerPage.getByLabel("Tracking number").fill("TRACK-BROWSER-001");
  await sellerPage.getByRole("button", { name: "Mark shipped" }).click();
  await sellerPage.getByRole("button", { name: "Mark delivered" }).waitFor();
  await sellerPage.getByText("TRACK-BROWSER-001", { exact: false }).waitFor();
  await sellerPage.getByRole("button", { name: "Mark delivered" }).click();
  await sellerPage.getByText("Delivered", { exact: true }).last().waitFor();
  await assertAxe(sellerPage, "seller fulfillment timeline");
  await sellerContext.close();

  const buyerContext = await newContext(browser, buyer, { width: 390, height: 844 });
  const buyerPage = await buyerContext.newPage();
  watch(buyerPage, "fulfillment buyer");
  await open(buyerPage, "/dashboard/buyer/orders", "buyer orders");
  await buyerPage.getByText(orderNumber, { exact: true }).waitFor();
  for (const label of ["Processing", "Shipped", "Delivered"]) {
    await buyerPage.getByText(label, { exact: true }).last().waitFor();
  }
  await buyerPage.getByText("TRACK-BROWSER-001", { exact: false }).waitFor();
  await assertAxe(buyerPage, "buyer fulfillment timeline");
  await buyerContext.close();

  const [{ data: events, error: eventsError }, { data: notifications, error: notificationError }, { data: escrow, error: escrowReadError }] = await Promise.all([
    admin.from("order_fulfillment_events").select("to_status").eq("order_id", order.id),
    admin.from("notifications").select("id").eq("metadata->>order_id", order.id),
    admin.from("escrow_transactions").select("status,released_at").eq("order_id", order.id).single(),
  ]);
  if (eventsError) throw eventsError;
  if (notificationError) throw notificationError;
  if (escrowReadError) throw escrowReadError;
  assert.deepEqual((events || []).map((event) => event.to_status).sort(), ["delivered", "processing", "shipped"]);
  assert.equal((notifications || []).length, 3, "buyer should receive one notification per transition");
  assert.equal(escrow.status, "held", "seller delivery must not release escrow");
  assert.equal(escrow.released_at, null, "seller delivery must not set escrow released_at");
  assert.deepEqual(browserErrors, [], `fulfillment browser errors\n${browserErrors.join("\n")}`);
  process.stdout.write("Atomic fulfillment seller/buyer browser + WCAG regression passed\n");
} finally {
  await browser.close();
}
