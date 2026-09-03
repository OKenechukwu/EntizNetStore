import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  migration: "supabase/migrations/20260903133000_p0_atomic_fulfillment_tracking_authority.sql",
  canonicalRoute: "app/api/seller/orders/[id]/status/route.ts",
  legacyRoute: "app/api/orders/fulfillment/route.ts",
  buyerOrders: "app/dashboard/buyer/orders/page.tsx",
  sellerOrders: "app/dashboard/orders/page.tsx",
  sellerActions: "components/seller/SellerOrderActions.tsx",
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
mustContain("migration", /revoke all on table public\.order_fulfillment_events[\s\S]*?service_role/i, "fulfillment ledger must revoke default service-role mutations");
mustContain("migration", /grant select on table public\.order_fulfillment_events[\s\S]*?authenticated, service_role/i, "fulfillment ledger must be read-only over the API surface");
mustContain("migration", /bool_or\(coalesce\(oi\.requires_shipping, true\)\)/i, "shipping requirement must be derived from order items");
mustContain("migration", /shipping_not_required_for_order/i, "digital-only orders must reject fabricated shipping transitions");
mustContain("migration", /v_order\.status = 'processing' and not v_requires_shipping/i, "digital-only processing -> delivered path missing");
mustNotContain("migration", /update\s+public\.escrow_transactions/i, "seller fulfillment must never update escrow");
mustNotContain("migration", /delete\s+from\s+public\.escrow_transactions/i, "seller fulfillment must never delete escrow");

mustContain("canonicalRoute", /\.rpc\("transition_seller_order"/i, "canonical seller route must use DB authority");
mustNotContain("canonicalRoute", /\.from\(["'](?:orders|order_items|escrow_transactions|notifications)["']\)/i, "canonical route must not recreate multi-write fulfillment");
mustNotContain("canonicalRoute", /error\.message\s*\|\|/i, "canonical route must not blindly expose raw DB error text");
mustNotContain("canonicalRoute", /code\s*:\s*error\.message/i, "canonical route must never return raw DB error text as a public code");
mustContain("canonicalRoute", /Object\.hasOwn\(publicValidationMessages, candidate\)/i, "canonical route must allowlist database validation messages before exposing a code");
mustContain("canonicalRoute", /shipping_not_required_for_order/i, "canonical route must normalize digital shipping rejection");
mustContain("canonicalRoute", /fulfillment_authority_unavailable/i, "canonical route must fail closed while the migration is unavailable");
mustContain("canonicalRoute", /Retry-After/i, "temporary fulfillment-authority outage should expose bounded retry guidance");
mustContain("canonicalRoute", /invalid_fulfillment_update/i, "canonical route must collapse unknown validation failures to a fixed public code");
const authorityProbeIndex = source.canonicalRoute.indexOf('.from("order_fulfillment_events")');
const authorityRpcIndex = source.canonicalRoute.indexOf('.rpc("transition_seller_order"');
assert.ok(authorityProbeIndex >= 0, "canonical route must positively probe the new fulfillment ledger");
assert.ok(authorityRpcIndex > authorityProbeIndex, "canonical route must probe authority readiness before invoking the same-named RPC");

mustContain("legacyRoute", /status:\s*410/i, "legacy fulfillment route must be retired with 410");
mustContain("legacyRoute", /legacy_fulfillment_retired/i, "legacy retirement code missing");
mustNotContain("legacyRoute", /@\/lib\/supabase|\.from\(|escrow_transactions|\.update\(/i, "legacy route contains a live database mutation path");

for (const key of ["buyerOrders", "sellerOrders"]) {
  mustContain(key, /\.from\("order_fulfillment_events"\)/i, `${key} must load authoritative fulfillment events separately`);
  mustContain(key, /eventsByOrder/i, `${key} must merge separately loaded timeline evidence by order id`);
  mustContain(key, /<OrderFulfillmentTimeline/i, `${key} must render the shared timeline`);
  mustContain(key, /<Price\s+amount=/i, `${key} must use canonical display currency formatting`);
  mustNotContain(key, /<main\b/i, `${key} must rely on the root layout's single global main landmark`);
  mustNotContain(
    key,
    /order_items\([^"\n]*\),\s*order_fulfillment_events\(/i,
    `${key} must not make base order rendering depend on the new ledger relation`,
  );
}
mustContain("buyerOrders", /detailedTimelineAvailable\s*=\s*false/i, "buyer orders must degrade to legacy status if detailed timeline is not yet available");
mustContain("sellerOrders", /requires_shipping/i, "seller order query must load authoritative item shipping facts");
mustContain("sellerOrders", /fulfillmentAuthorityReady\s*=\s*false/i, "seller orders must detect unavailable fulfillment authority");
mustContain("sellerOrders", /fulfillmentAuthorityReady\s*&&\s*\(/i, "seller mutation controls must be suppressed until authority readiness is proven");
mustContain("sellerOrders", /requiresShipping=\{requiresShipping\}/i, "seller UI must pass item-derived shipping requirements to actions");
mustContain("sellerActions", /requiresShipping\s*\?/i, "seller actions must branch physical versus digital fulfillment");
mustContain("sellerActions", /\?\s*"shipped"\s*:\s*"delivered"/i, "digital-only orders must skip shipping in seller UI");
mustNotContain("timeline", /href=|https?:\/\//i, "tracking timeline must not turn seller-provided data into arbitrary links");

mustContain("payout", /update public\.escrow_transactions[\s\S]*?status = 'released'/i, "payout settlement must remain the escrow release authority");
mustContain("payout", /o\.status = 'delivered'[\s\S]*?o\.fulfillment_status = 'fulfilled'/i, "payout eligibility must remain delivery + fulfillment gated");

process.stdout.write("Fulfillment authority static boundary verified\n");
