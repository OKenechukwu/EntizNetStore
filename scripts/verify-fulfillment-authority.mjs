import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  migration: "supabase/migrations/20260903133000_p0_atomic_fulfillment_tracking_authority.sql",
  settlementMigration: "supabase/migrations/20260904052000_p0_trusted_settlement_payout_authority.sql",
  settlementIntegration: "supabase/migrations/20260904070000_p0_settlement_authority_integration_hardening.sql",
  canonicalRoute: "app/api/seller/orders/[id]/status/route.ts",
  buyerReceiptRoute: "app/api/buyer/orders/[id]/confirm-receipt/route.ts",
  legacyRoute: "app/api/orders/fulfillment/route.ts",
  buyerOrders: "app/dashboard/buyer/orders/page.tsx",
  sellerOrders: "app/dashboard/orders/page.tsx",
  sellerActions: "components/seller/SellerOrderActions.tsx",
  buyerReceiptControl: "components/orders/BuyerReceiptConfirmation.tsx",
  timeline: "components/orders/OrderFulfillmentTimeline.tsx",
  rolloutInterlock: "scripts/test-fulfillment-rollout-interlock.mjs",
  workflow: ".github/workflows/fulfillment-authority-security.yml",
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

mustContain("settlementMigration", /create table private\.order_settlement_confirmations/i, "trusted settlement evidence table missing");
mustContain("settlementMigration", /revoke all on table private\.order_settlement_confirmations[\s\S]*?service_role/i, "settlement evidence must deny direct service-role writes");
mustContain("settlementMigration", /authority_type in \('buyer','admin'\)/i, "settlement authority provenance constraint missing");
mustContain("settlementMigration", /join private\.order_settlement_confirmations c on c\.order_id = o\.id/i, "payout reservation must require trusted settlement evidence");
mustContain("settlementMigration", /c\.confirmed_at <= p_eligible_before/i, "payout hold clock must use trusted confirmation time");
mustContain("settlementMigration", /refund_requests[\s\S]*?requested','approved','processing/i, "payout reservation/finalization must consider active refund state");
mustContain("settlementMigration", /order_disputes[\s\S]*?open','under_review/i, "payout reservation/finalization must consider active dispute state");
mustContain("settlementMigration", /for update of pi, e/i, "payout finalization must lock reserved payout/escrow rows");
mustContain("settlementMigration", /select \* into v_order[\s\S]*?for update/i, "payout finalization must lock canonical order authority");
mustContain("settlementMigration", /settlement_confirmation_is_immutable/i, "trusted settlement evidence must be immutable");
mustContain("settlementIntegration", /insert into public\.notifications\([\s\S]*?message,/i, "buyer settlement notification must use canonical notification message column");
mustContain("settlementIntegration", /alter function public\.request_seller_payout[\s\S]*?set search_path = pg_catalog, public/i, "payout reservation must retain approved hardened search_path");
mustContain("settlementIntegration", /alter function public\.finalize_seller_payout_v1[\s\S]*?set search_path = pg_catalog, public/i, "payout finalization must retain approved hardened search_path");

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

mustContain("buyerReceiptRoute", /\.rpc\("confirm_buyer_order_receipt"/i, "buyer receipt route must delegate to database settlement authority");
mustContain("buyerReceiptRoute", /p_order_id:\s*orderId\.data/i, "buyer receipt route must pass only canonical order identity");
mustContain("buyerReceiptRoute", /p_idempotency_key:\s*input\.data\.idempotencyKey/i, "buyer receipt route must carry an idempotency key");
mustContain("buyerReceiptRoute", /settlement_authority_unavailable/i, "buyer receipt route must fail closed while settlement authority is unavailable");
mustContain("buyerReceiptRoute", /Cache-Control[^\n]*no-store|"Cache-Control":\s*"no-store/i, "buyer receipt mutation response must be non-cacheable");
mustNotContain("buyerReceiptRoute", /sellerId|seller_id|buyerId|buyer_id|eligibleBefore|eligible_before|escrow/i, "buyer receipt route must not accept financial/counterparty authority inputs");
mustNotContain("buyerReceiptRoute", /\.from\(["'](?:orders|escrow_transactions|payout_requests)["']\)/i, "buyer receipt route must not recreate settlement writes in application code");

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
mustContain("buyerOrders", /\.rpc\("get_order_settlement_confirmation"/i, "buyer orders must read trusted settlement state through participant-scoped RPC");
mustContain("buyerOrders", /settlementAuthorityReady\s*=\s*false/i, "buyer orders must detect unavailable settlement authority");
mustContain("buyerOrders", /settlementAuthorityReady\s*&&/i, "buyer receipt control must be suppressed unless settlement authority is ready");
mustContain("buyerOrders", /<BuyerReceiptConfirmation\s+orderId=/i, "buyer orders must expose receipt confirmation only through the dedicated control");
mustContain("sellerOrders", /requires_shipping/i, "seller order query must load authoritative item shipping facts");
mustContain("sellerOrders", /fulfillmentAuthorityReady\s*=\s*false/i, "seller orders must detect unavailable fulfillment authority");
mustContain("sellerOrders", /fulfillmentAuthorityReady\s*&&\s*\(/i, "seller mutation controls must be suppressed until authority readiness is proven");
mustContain("sellerOrders", /requiresShipping=\{requiresShipping\}/i, "seller UI must pass item-derived shipping requirements to actions");
mustContain("sellerActions", /requiresShipping\s*\?/i, "seller actions must branch physical versus digital fulfillment");
mustContain("sellerActions", /\?\s*"shipped"\s*:\s*"delivered"/i, "digital-only orders must skip shipping in seller UI");
mustContain("buyerReceiptControl", /crypto\.randomUUID\(\)/i, "buyer receipt control must create a durable retry idempotency key");
mustContain("buyerReceiptControl", /idempotencyKey\.current/i, "buyer receipt retries must reuse the same in-flight idempotency key");
mustContain("buyerReceiptControl", /Confirm only after you have received and accepted/i, "buyer must receive an explicit settlement consequence warning");
mustContain("buyerReceiptControl", /router\.refresh\(\)/i, "successful receipt confirmation must refresh authoritative server state");
mustNotContain("timeline", /href=|https?:\/\//i, "tracking timeline must not turn seller-provided data into arbitrary links");

mustContain("rolloutInterlock", /Fulfillment updates are temporarily unavailable/i, "rollout interlock must verify the seller fallback state");
mustContain("rolloutInterlock", /mutation\.status,\s*503/i, "rollout interlock must require mutation fail-closed HTTP 503");
mustContain("rolloutInterlock", /persistedOrder\.status,\s*"confirmed"/i, "rollout interlock must prove order state is unchanged");
mustContain("rolloutInterlock", /events\.length,\s*0/i, "rollout interlock must prove no evidence was partially written");
mustContain("rolloutInterlock", /notices\.length,\s*0/i, "rollout interlock must prove no notification was partially written");
mustContain("rolloutInterlock", /escrow\.status,\s*"held"/i, "rollout interlock must prove escrow is unchanged");
mustContain("workflow", /revoke select on table public\.order_fulfillment_events from authenticated/i, "dedicated workflow must simulate migration-not-ready state");
mustContain("workflow", /test-fulfillment-rollout-interlock\.mjs/i, "dedicated workflow must execute the real-app rollout interlock");
mustContain("workflow", /test-settlement-payout-authority\.sql/i, "dedicated workflow must execute settlement/payout adversarial regression");
mustContain("workflow", /grant select on table public\.order_fulfillment_events to authenticated/i, "dedicated workflow must restore ledger reads before the normal browser flow");

process.stdout.write("Fulfillment + trusted settlement authority static boundary verified\n");
