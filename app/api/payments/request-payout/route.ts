import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Payouts remain closed until Stripe Connect onboarding, connected-account
  // storage, transfer reconciliation, and the release/dispute policy are all
  // configured. Never simulate a transfer or mark escrow released early.
  return NextResponse.json(
    {
      error: "Seller payouts are not yet available",
      code: "STRIPE_CONNECT_NOT_CONFIGURED",
    },
    { status: 503 },
  );
}
