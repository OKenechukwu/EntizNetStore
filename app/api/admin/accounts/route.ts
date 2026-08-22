import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const filtersSchema = z.object({
  query: z.string().trim().max(200).default(""),
  capability: z.enum(["all", "buyer", "seller", "business"]).default("all"),
  status: z.enum(["all", "active", "suspended"]).default("all"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: NextRequest) {
  const { user, errorResponse } = await requireAdmin();
  if (errorResponse || !user) return errorResponse;

  const url = new URL(request.url);
  const parsed = filtersSchema.safeParse({
    query: url.searchParams.get("query") ?? "",
    capability: url.searchParams.get("capability") ?? "all",
    status: url.searchParams.get("status") ?? "all",
    page: url.searchParams.get("page") ?? "1",
    perPage: url.searchParams.get("perPage") ?? "50",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid account filters" }, { status: 400 });
  }

  const input = parsed.data;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("admin_search_marketplace_accounts", {
    p_admin_id: user.id,
    p_query: input.query,
    p_capability: input.capability,
    p_status: input.status,
    p_limit: input.perPage,
    p_offset: (input.page - 1) * input.perPage,
  });

  if (error) {
    console.error("Unable to search marketplace accounts", error);
    return NextResponse.json({ error: "Unable to load marketplace accounts" }, { status: 500 });
  }

  const rows = data ?? [];
  return NextResponse.json({
    accounts: rows,
    page: input.page,
    perPage: input.perPage,
    total: Number(rows[0]?.total_count ?? 0),
  });
}
