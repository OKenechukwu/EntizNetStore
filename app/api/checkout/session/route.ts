import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

const requestSchema = z.object({
  cartId: z.string().uuid(),
  quoteId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid checkout request" },
      { status: 400 },
    );
  }

  const { data: rows, error } = await supabase.rpc("create_checkout_session_v2", {
    p_cart_id: parsed.data.cartId,
    p_quote_id: parsed.data.quoteId,
    p_idempotency_key: parsed.data.idempotencyKey,
  });

  if (error || !rows?.[0]) {
    const message = error?.message || "Unable to freeze checkout";
    const forbidden = error?.code === "42501";
    return NextResponse.json(
      { error: message },
      { status: forbidden ? 403 : 400 },
    );
  }

  return NextResponse.json({
    checkoutSessionId: rows[0].session_id,
    amountCents: Number(rows[0].amount_cents),
    currency: "usd",
  });
}
