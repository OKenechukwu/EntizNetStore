import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const schema = z.object({
  disputeId: z.string().uuid(),
  status: z.enum(["under_review", "resolved_buyer", "resolved_seller", "closed"]),
  notes: z.string().trim().max(10000).default(""),
}).superRefine((value, ctx) => {
  if (["resolved_buyer", "resolved_seller", "closed"].includes(value.status) && !value.notes) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["notes"], message: "Resolution notes are required" });
  }
});

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAdmin();
  if (errorResponse || !user) return errorResponse;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid dispute transition" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.rpc("admin_transition_order_dispute", {
    p_admin_id: user.id,
    p_dispute_id: parsed.data.disputeId,
    p_status: parsed.data.status,
    p_notes: parsed.data.notes || null,
  });

  if (error) {
    console.error("Unable to transition order dispute", error);
    return NextResponse.json({ error: error.message || "Unable to update dispute" }, { status: error.code === "42501" ? 403 : 409 });
  }

  return NextResponse.json({ ok: true });
}
