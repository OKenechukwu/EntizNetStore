import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  migration: "supabase/migrations/20260903133000_p0_atomic_fulfillment_tracking_authority.sql",
  canonicalRoute: "app/api/seller/orders/[id]/status/route.ts",
  legacyRoute: "app/api/orders/fulfillment/route.ts",
  buyerOrders: "app/dashboard/buyer/orders/page.tsx",
  sellerOrders: "app/dashboard/orders/page.tsx",
  timeline: "components/orders/OrderFulfillmentTimeline.tsx",
  payout: "supabase/migrations/20260822070107_payout_ledger_foundation.sql",
};

const source = Object.fromEntries(
  await Promise.all(Object.entries(files).map(async ([key, path]) => [key, await readFile(path, "utf8")])),
);

function mustContain(key, pattern, message) {
  assert.match(source[key], pattern, message);
}
function mustNotContain(key, pattern, message) {
  assert.doesNotMatch(source[key], pattern, message);
}

mustContain("migration", /create table public\.order_fulfillment_events/i, "immutable fulfillment timeline table missing");
mustContain("migration", /app_private\.transition_seller_order_authoritative/i, "private fulfillment authority missing");
mustContain("migration", /security definer[\s\S]*?set search_path = ''/i, "private authority must pin empty search_path");
mustContain("migration", /create function public\.transition_seller_order[\s\S]*?security invoker/i, "public wrapper must be SECURITY INVOKER");
mustContain("migration", /for update/i, "fulfillment authority must row-lock the order");
mustContain("migration", /insert into public\.order_fulfillment_events/i, "transition must append timeline evidence");
mustContain("migration", /insert into public\.notifications/i, "transition must atomically notify the buyer");
mustContain("migration", /trg_order_fulfillment_events_immutable/i, "timeline immutability trigger missing");
mustNotContain("migration", /update\s+public\.escrow_transactions/i, "seller fulfillment must never update escrow");
mustNotContain("migration", /delete\s+from\s+public\.escrow_transactions/i, "seller fulfillment must never delete escrow");

mustContain("canonicalRoute", /\.rpc\("transition_seller_order"/i, "canonical seller route must use DB authority");
mustNotContain("canonicalRoute", /\.from\(["'](?:orders|order_items|escrow_transactions|notifications)["']\)/i, "canonical route must not recreate multi-write fulfillment");
mustNotContain("canonicalRoute", /error\.message\s*\|\|/i, "canonical route must not blindly expose raw DB error text");

mustContain("legacyRoute", /status:\s*410/i, "legacy fulfillment route must be retired with 410");
mustContain("legacyRoute", /legacy_fulfillment_retired/i, "legacy retirement code missing");
mustNotContain("legacyRoute", /@\/lib\/supabase|\.from\(|escrow_transactions|\.update\(/i, "legacy route contains a live database mutation path");

for (const key of ["buyerOrders", "sellerOrders"]) {
  mustContain(key, /order_fulfillment_events\(/i, `${key} must read authoritative fulfillment events`);
  mustContain(key, /<OrderFulfillmentTimeline/i, `${key} must render the shared timeline`);
  mustContain(key, /<Price\s+amount=/i, `${key} must use canonical display currency formatting`);
}
mustNotContain("timeline", /href=|https?:\/\//i, "tracking timeline must not turn seller-provided data into arbitrary links");

mustContain("payout", /update public\.escrow_transactions[\s\S]*?status = 'released'/i, "payout settlement must remain the escrow release authority");
mustContain("payout", /o\.status = 'delivered'[\s\S]*?o\.fulfillment_status = 'fulfilled'/i, "payout eligibility must remain delivery + fulfillment gated");

process.stdout.write("Fulfillment authority static boundary verified\n");
