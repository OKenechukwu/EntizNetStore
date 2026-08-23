import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const requestSchema = z.object({
  payoutRequestId: z.string().uuid(),
  reason: z.string().trim().min(1).max(500),
});

export async function POST(request: NextRequest) {
  const { user, errorResponse } = await requireAdmin();
  if (errorResponse || !user) return errorResponse;

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payout cancellation request" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("admin_cancel_seller_payout", {
    p_admin_id: user.id,
    p_payout_request_id: parsed.data.payoutRequestId,
    p_reason: parsed.data.reason,
  });

  if (error) {
    return NextResponse.json({ error: error.message || "Unable to cancel payout" }, { status: 400 });
  }

  return NextResponse.json({ ok: Boolean(data) });
}
