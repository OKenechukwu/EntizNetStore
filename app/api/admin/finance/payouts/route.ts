import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const requestSchema = z.object({
  sellerId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
});

function payoutConfiguration() {
  const provider = (process.env.PAYOUT_PROVIDER || "unconfigured").trim().toLowerCase();
  const holdDaysRaw = process.env.PAYOUT_HOLD_DAYS;
  const holdDays = holdDaysRaw ? Number.parseInt(holdDaysRaw, 10) : Number.NaN;
  return {
    provider,
    holdDays,
    configured: provider !== "unconfigured" && Number.isInteger(holdDays) && holdDays >= 0 && holdDays <= 365,
  };
}

export async function POST(request: NextRequest) {
  const { user, errorResponse } = await requireAdmin();
  if (errorResponse || !user) return errorResponse;

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payout request" }, { status: 400 });
  }

  const config = payoutConfiguration();
  if (!config.configured) {
    return NextResponse.json(
      {
        error: "Seller payouts are not configured for execution yet. Set an approved payout provider and payout hold policy before preparing live payouts.",
        code: "PAYOUT_PROVIDER_UNAVAILABLE",
      },
      { status: 503 },
    );
  }

  const eligibleBefore = new Date(Date.now() - config.holdDays * 24 * 60 * 60 * 1000).toISOString();
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("admin_create_seller_payout", {
    p_admin_id: user.id,
    p_seller_id: parsed.data.sellerId,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_eligible_before: eligibleBefore,
  });

  if (error || !data?.[0]) {
    const message = error?.message || "Unable to prepare Seller payout";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({
    payout: data[0],
    provider: config.provider,
    eligibilityCutoff: eligibleBefore,
  });
}
