import { NextResponse } from "next/server";

/**
 * Retired legacy fulfillment surface.
 *
 * This route previously performed independent order-item, escrow and order
 * writes. That made partial commerce state possible and incorrectly released
 * escrow when a seller marked an order delivered. All seller fulfillment now
 * goes through /api/seller/orders/:id/status and the atomic database authority.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "This fulfillment endpoint has been retired.",
      code: "legacy_fulfillment_retired",
      canonicalRoute: "/api/seller/orders/:id/status",
    },
    {
      status: 410,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
