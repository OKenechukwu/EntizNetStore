import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user, errorResponse } = await requireAdmin();
  if (errorResponse || !user) return errorResponse;

  const { id } = await context.params;
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("admin_get_marketplace_order", {
    p_admin_id: user.id,
    p_order_id: parsed.data,
  });

  if (error || !data) {
    console.error("Unable to load marketplace order", error);
    return NextResponse.json(
      { error: error?.message || "Marketplace order not found" },
      { status: error?.code === "42501" ? 403 : 404 },
    );
  }

  return NextResponse.json({ order: data });
}
