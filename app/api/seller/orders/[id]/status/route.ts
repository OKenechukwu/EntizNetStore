import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

const inputSchema = z
  .object({
    status: z.enum(["processing", "shipped", "delivered"]),
    trackingNumber: z.string().trim().max(200).optional(),
    shippingCarrier: z.string().trim().max(100).optional(),
  })
  .strict();

const conflictErrors = new Set(["invalid_fulfillment_transition", "conflicting_tracking_retry"]);

function fulfillmentError(error: { code?: string; message?: string }) {
  const code = error.message || "fulfillment_update_failed";
  if (error.code === "28000") {
    return NextResponse.json({ error: "Authentication required", code: "authentication_required" }, { status: 401 });
  }
  if (error.code === "42501") {
    return NextResponse.json({ error: "Order not found", code: "order_not_found" }, { status: 404 });
  }
  if (error.code === "22023") {
    const status = conflictErrors.has(code) ? 409 : 400;
    const messages: Record<string, string> = {
      only_paid_orders_can_be_fulfilled: "Only paid orders can be fulfilled.",
      invalid_fulfillment_transition: "The order changed state. Refresh and try again.",
      carrier_and_tracking_required: "Carrier and tracking number are required before shipping.",
      invalid_tracking_number: "Enter a valid single-line tracking number.",
      invalid_shipping_carrier: "Enter a valid single-line shipping carrier.",
      conflicting_tracking_retry: "This order already has different tracking details. Refresh before continuing.",
    };
    return NextResponse.json(
      { error: messages[code] || "Invalid fulfillment update", code },
      { status },
    );
  }
  return NextResponse.json(
    { error: "Unable to update order fulfillment", code: "fulfillment_update_failed" },
    { status: 500 },
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const orderId = z.string().uuid().safeParse(id);
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!orderId.success || !input.success) {
    return NextResponse.json(
      { error: "Invalid fulfillment update", code: "invalid_request" },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required", code: "authentication_required" },
      { status: 401 },
    );
  }

  const { data, error } = await supabase.rpc("transition_seller_order", {
    p_order_id: orderId.data,
    p_next_status: input.data.status,
    p_tracking_number: input.data.trackingNumber || null,
    p_shipping_carrier: input.data.shippingCarrier || null,
  });

  if (error) return fulfillmentError(error);

  const result = Array.isArray(data) ? data[0] : data;
  if (!result) {
    return NextResponse.json(
      { error: "Unable to confirm fulfillment update", code: "missing_authoritative_result" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      order: {
        status: result.order_status,
        fulfillmentStatus: result.order_fulfillment_status,
        fulfillmentEventId: result.fulfillment_event_id,
        shippingCarrier: result.canonical_shipping_carrier,
        trackingNumber: result.canonical_tracking_number,
        shippedAt: result.canonical_shipped_at,
        deliveredAt: result.canonical_delivered_at,
        idempotent: Boolean(result.idempotent),
      },
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
