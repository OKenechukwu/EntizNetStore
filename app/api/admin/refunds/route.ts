import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const schema = z.object({
  query: z.string().trim().max(200).default(""),
  status: z.enum(["all", "requested", "approved", "rejected", "processing", "succeeded", "failed", "cancelled"]).default("all"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: NextRequest) {
  const { user, errorResponse } = await requireAdmin();
  if (errorResponse || !user) return errorResponse;

  const url = new URL(request.url);
  const parsed = schema.safeParse({
    query: url.searchParams.get("query") ?? "",
    status: url.searchParams.get("status") ?? "all",
    page: url.searchParams.get("page") ?? "1",
    perPage: url.searchParams.get("perPage") ?? "50",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid refund filters" }, { status: 400 });
  }

  const input = parsed.data;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("admin_search_refund_requests", {
    p_admin_id: user.id,
    p_query: input.query,
    p_status: input.status,
    p_limit: input.perPage,
    p_offset: (input.page - 1) * input.perPage,
  });

  if (error) {
    console.error("Unable to search refund requests", error);
    return NextResponse.json({ error: "Unable to load refund requests" }, { status: 500 });
  }

  const refunds = data ?? [];
  return NextResponse.json({
    refunds,
    page: input.page,
    perPage: input.perPage,
    total: Number(refunds[0]?.total_count ?? 0),
  });
}
