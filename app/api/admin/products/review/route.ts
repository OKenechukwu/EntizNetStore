import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { validateMessageContent } from "@/lib/validation";

const reviewSchema = z.object({
  productId: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
  notes: z.string().trim().max(5000).optional().default(""),
}).superRefine((value, ctx) => {
  if (value.status === "rejected" && !value.notes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["notes"],
      message: "Rejection notes are required",
    });
  }
});

export async function POST(request: NextRequest) {
  const { user, errorResponse } = await requireAdmin();
  if (errorResponse) return errorResponse;

  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid moderation decision" },
      { status: 400 },
    );
  }

  if (parsed.data.notes) {
    const validation = validateMessageContent(parsed.data.notes);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.errors[0] }, { status: 400 });
    }
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.rpc("admin_review_product", {
    p_admin_id: user.id,
    p_product_id: parsed.data.productId,
    p_status: parsed.data.status,
    p_notes: parsed.data.notes || null,
  });

  if (error) {
    const message = error.message;
    const status = message.includes("not_found") ? 404
      : message.includes("not_pending") ? 409
      : message.includes("authorization") ? 403
      : 400;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ success: true, status: parsed.data.status });
}
