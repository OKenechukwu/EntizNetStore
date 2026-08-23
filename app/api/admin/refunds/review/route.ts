import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const schema = z.object({
  refundRequestId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  notes: z.string().trim().max(10000).default(""),
}).superRefine((value, ctx) => {
  if (value.decision === "rejected" && !value.notes) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["notes"], message: "Rejection notes are required" });
  }
});

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAdmin();
  if (errorResponse || !user) return errorResponse;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid refund review" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.rpc("admin_review_refund_request", {
    p_admin_id: user.id,
    p_refund_request_id: parsed.data.refundRequestId,
    p_decision: parsed.data.decision,
    p_notes: parsed.data.notes || null,
  });

  if (error) {
    console.error("Unable to review refund request", error);
    return NextResponse.json({ error: error.message || "Unable to review refund request" }, { status: error.code === "42501" ? 403 : 409 });
  }

  return NextResponse.json({ ok: true });
}
