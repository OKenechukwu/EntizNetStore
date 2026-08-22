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
    return NextResponse.json({ error: "Invalid account ID" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("admin_get_marketplace_account", {
    p_admin_id: user.id,
    p_target_user_id: parsed.data,
  });

  if (error) {
    console.error("Unable to load marketplace account", error);
    return NextResponse.json(
      { error: error.message || "Unable to load marketplace account" },
      { status: error.code === "42501" ? 403 : 404 },
    );
  }

  return NextResponse.json({ account: data });
}
