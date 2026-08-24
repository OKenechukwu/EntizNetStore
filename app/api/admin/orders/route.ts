import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const filtersSchema = z.object({
  query: z.string().trim().max(200).default(""),
  orderStatus: z.enum(["all", "pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"]).default("all"),
  paymentStatus: z.enum(["all", "pending", "paid", "failed", "refunded", "partially_refunded"]).default("all"),
  fulfillmentStatus: z.enum(["all", "unfulfilled", "partial", "fulfilled"]).default("all"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: NextRequest) {
  const { user, errorResponse } = await requireAdmin();
  if (errorResponse || !user) return errorResponse;

  const url = new URL(request.url);
  const parsed = filtersSchema.safeParse({
    query: url.searchParams.get("query") ?? "",
    orderStatus: url.searchParams.get("orderStatus") ?? "all",
    paymentStatus: url.searchParams.get("paymentStatus") ?? "all",
    fulfillmentStatus: url.searchParams.get("fulfillmentStatus") ?? "all",
    page: url.searchParams.get("page") ?? "1",
    perPage: url.searchParams.get("perPage") ?? "50",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order filters" }, { status: 400 });
  }

  const input = parsed.data;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("admin_search_marketplace_orders", {
    p_admin_id: user.id,
    p_query: input.query,
    p_order_status: input.orderStatus,
    p_payment_status: input.paymentStatus,
    p_fulfillment_status: input.fulfillmentStatus,
    p_limit: input.perPage,
    p_offset: (input.page - 1) * input.perPage,
  });

  if (error) {
    console.error("Unable to search marketplace orders", error);
    return NextResponse.json({ error: "Unable to load marketplace orders" }, { status: 500 });
  }

  const orders = data ?? [];
  return NextResponse.json({
    orders,
    page: input.page,
    perPage: input.perPage,
    total: Number(orders[0]?.total_count ?? 0),
  });
}
