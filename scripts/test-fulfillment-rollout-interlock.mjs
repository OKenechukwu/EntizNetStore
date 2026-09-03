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
assert.ok(supabaseUrl && anonKey && serviceRoleKey, "Supabase local verification credentials are required");

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(playwrightNodeModules, "playwright"));
const axeCore = require(path.join(playwrightNodeModules, "axe-core"));
const axeSource = axeCore.source;
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = "Fulfillment-Rollout-Interlock-2026!";
const createdUserIds = [];
let orderId = null;

function cookieHeader(cookieJar) {
  return [...cookieJar.entries()].map(([name, entry]) => `${name}=${entry.value}`).join("; ");
}

async function createIdentity(label) {
  const email = `fulfillment-interlock-${label}-${runId}@example.test`;
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
        cookiesToSet.forEach(({ name, value, options }) => cookieJar.set(name, { value, options: options || {} }));
      },
    },
  });
  const { error: signInError } = await authClient.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, cookieJar, cookie: cookieHeader(cookieJar) };
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
      targets: violation.nodes.slice(0, 5).map((node) => node.target),
    }));
  });
  assert.deepEqual(violations, [], `${label}: WCAG violations:\n${JSON.stringify(violations, null, 2)}`);
}

const buyer = await createIdentity("buyer");
const seller = await createIdentity("seller");

try {
  const { error: buyerProfileError } = await admin.from("profiles_buyer").insert({
    id: buyer.id,
    display_name: "Fulfillment Interlock Buyer",
  });
  if (buyerProfileError) throw buyerProfileError;

  const { error: sellerProfileError } = await admin.from("profiles_seller").insert({
    id: seller.id,
    storefront_name: "Fulfillment Interlock Seller",
    store_slug: `fulfillment-interlock-${runId}`.slice(0, 120),
    verification_status: "verified",
  });
  if (sellerProfileError) throw sellerProfileError;

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      order_number: `ENS-INTERLOCK-${runId.slice(-10)}`,
      buyer_id: buyer.id,
      seller_id: seller.id,
      status: "confirmed",
      subtotal_cents: 2500,
      total_cents: 2500,
      payment_status: "paid",
      fulfillment_status: "unfulfilled",
      shipping_address: { country: "US" },
      metadata: { verification_fixture: "fulfillment_rollout_interlock" },
    })
    .select("id")
    .single();
  if (orderError || !order) throw orderError || new Error("Unable to create rollout-interlock order");
  orderId = order.id;

  const { error: itemError } = await admin.from("order_items").insert({
    order_id: order.id,
    quantity: 1,
    price_cents: 2500,
    total_cents: 2500,
    product_title: "Fulfillment Interlock Physical Item",
    requires_shipping: true,
    is_digital: false,
    fulfillment_status: "unfulfilled",
  });
  if (itemError) throw itemError;

  const { error: escrowError } = await admin.from("escrow_transactions").insert({
    order_id: order.id,
    seller_id: seller.id,
    amount_cents: 2250,
    status: "held",
  });
  if (escrowError) throw escrowError;

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => localStorage.setItem("entiznet-age-verified", "true"));
    await context.addCookies(browserCookies(seller));
    const page = await context.newPage();
    const browserErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));

    const response = await page.goto(`${origin}/dashboard/orders`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    assert.ok(response && response.status() < 400, `seller orders fallback returned ${response?.status()}`);
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await page.getByText(/Fulfillment updates are temporarily unavailable/i).waitFor();
    assert.equal(
      await page.getByRole("button", { name: /Start processing|Mark shipped|Mark delivered|Mark fulfilled/i }).count(),
      0,
      "seller mutation controls rendered while authority probe was unavailable",
    );
    assert.equal(await page.locator("main#main").count(), 1, "fallback seller view must keep one main landmark");
    assert.equal(await page.locator("main main").count(), 0, "fallback seller view rendered nested main landmarks");
    await assertAxe(page, "fulfillment rollout interlock seller view");

    const mutation = await page.evaluate(async (id) => {
      const result = await fetch(`/api/seller/orders/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "processing" }),
      });
      return { status: result.status, body: await result.json() };
    }, order.id);
    assert.equal(mutation.status, 503, `authority-unavailable mutation expected 503, got ${mutation.status}`);
    assert.equal(mutation.body.code, "fulfillment_authority_unavailable");
    assert.equal(browserErrors.length, 0, `browser errors during fail-closed rollout state:\n${browserErrors.join("\n")}`);
    await context.close();
  } finally {
    await browser.close();
  }

  const [{ data: persistedOrder, error: persistedOrderError }, { data: events, error: eventsError }, { data: notices, error: noticesError }, { data: escrow, error: escrowReadError }] = await Promise.all([
    admin.from("orders").select("status, fulfillment_status").eq("id", order.id).single(),
    admin.from("order_fulfillment_events").select("id").eq("order_id", order.id),
    admin.from("notifications").select("id").eq("metadata->>order_id", order.id),
    admin.from("escrow_transactions").select("status").eq("order_id", order.id).single(),
  ]);
  if (persistedOrderError || eventsError || noticesError || escrowReadError) {
    throw persistedOrderError || eventsError || noticesError || escrowReadError;
  }
  assert.equal(persistedOrder.status, "confirmed");
  assert.equal(persistedOrder.fulfillment_status, "unfulfilled");
  assert.equal(events.length, 0, "authority-unavailable mutation created fulfillment evidence");
  assert.equal(notices.length, 0, "authority-unavailable mutation created buyer notification");
  assert.equal(escrow.status, "held", "authority-unavailable mutation changed escrow");

  process.stdout.write("Fulfillment migration rollout interlock passed\n");
} finally {
  if (orderId) {
    await admin.from("escrow_transactions").delete().eq("order_id", orderId);
    await admin.from("order_items").delete().eq("order_id", orderId);
    await admin.from("orders").delete().eq("id", orderId);
  }
  if (seller?.id) await admin.from("profiles_seller").delete().eq("id", seller.id);
  if (buyer?.id) await admin.from("profiles_buyer").delete().eq("id", buyer.id);
  for (const id of createdUserIds.reverse()) {
    try {
      await admin.auth.admin.deleteUser(id);
    } catch {
      // Disposable local verification database; cleanup must not mask assertions.
    }
  }
}
