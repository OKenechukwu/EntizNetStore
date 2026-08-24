import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const actionSchema = z.object({
  userId: z.string().uuid(),
  capability: z.enum(["buyer", "seller", "business"]),
  status: z.enum(["active", "suspended"]),
  reason: z.string().trim().max(2000).nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.status === "suspended" && !value.reason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reason"],
      message: "A suspension reason is required",
    });
  }
});

export async function POST(request: NextRequest) {
  const { user, errorResponse } = await requireAdmin();
  if (errorResponse || !user) return errorResponse;

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid account action" },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.rpc("admin_set_marketplace_capability_state", {
    p_admin_id: user.id,
    p_target_user_id: parsed.data.userId,
    p_capability: parsed.data.capability,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason || null,
  });

  if (error) {
    console.error("Unable to change marketplace capability state", error);
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json({ error: error.message || "Unable to update account" }, { status });
  }

  return NextResponse.json({ ok: true });
}
