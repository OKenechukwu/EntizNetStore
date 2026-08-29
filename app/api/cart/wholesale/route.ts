import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { hydrateActiveCart } from "@/lib/cart/server";

const setWholesaleItemSchema = z.object({
  offerId: z.string().uuid(),
  quantity: z.number().int().min(1).max(100000),
});

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = setWholesaleItemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid wholesale cart item" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc("buyer_set_wholesale_cart_item", {
    p_offer_id: parsed.data.offerId,
    p_quantity: parsed.data.quantity,
  });

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Unable to update wholesale cart" },
      { status: error?.code === "42501" ? 403 : 400 },
    );
  }

  try {
    const cart = await hydrateActiveCart(user.id);
    return NextResponse.json({ itemId: data, cart });
  } catch (caught) {
    console.error("Wholesale cart update succeeded but hydration failed", caught);
    return NextResponse.json({ itemId: data, cart: null });
  }
}
