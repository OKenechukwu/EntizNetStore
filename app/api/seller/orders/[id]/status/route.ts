import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

const inputSchema = z.object({
  status: z.enum(["processing", "shipped", "delivered"]),
  trackingNumber: z.string().trim().max(200).optional(),
  shippingCarrier: z.string().trim().max(100).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const orderId = z.string().uuid().safeParse(params.id);
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!orderId.success || !input.success) {
    return NextResponse.json({ error: "Invalid fulfillment update" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.rpc("transition_seller_order", {
    p_order_id: orderId.data,
    p_next_status: input.data.status,
    p_tracking_number: input.data.trackingNumber || null,
    p_shipping_carrier: input.data.shippingCarrier || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
