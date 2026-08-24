import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { hydrateActiveCart } from "@/lib/cart/server";

async function authBuyer() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await authBuyer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.rpc("buyer_get_or_create_cart");
  if (error) {
    return NextResponse.json(
      { error: error.message || "Unable to initialize cart" },
      { status: error.code === "42501" ? 403 : 400 },
    );
  }

  try {
    const cart = await hydrateActiveCart(user.id);
    return NextResponse.json({ cart });
  } catch (error) {
    console.error("Failed to hydrate cart", error);
    return NextResponse.json({ error: "Unable to load cart" }, { status: 500 });
  }
}

const setItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(100),
});

async function setItem(request: NextRequest) {
  const { supabase, user } = await authBuyer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = setItemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid cart item" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc("buyer_set_cart_item", {
    p_product_id: parsed.data.productId,
    p_variant_id: parsed.data.variantId,
    p_quantity: parsed.data.quantity,
  });

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Unable to update cart" },
      { status: error?.code === "42501" ? 403 : 400 },
    );
  }

  try {
    const cart = await hydrateActiveCart(user.id);
    return NextResponse.json({ itemId: data, cart });
  } catch (caught) {
    console.error("Cart update succeeded but hydration failed", caught);
    return NextResponse.json({ itemId: data, cart: null }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  return setItem(request);
}

export async function PATCH(request: NextRequest) {
  return setItem(request);
}

const deleteSchema = z.union([
  z.object({ itemId: z.string().uuid(), clear: z.undefined().optional() }),
  z.object({ clear: z.literal(true), itemId: z.undefined().optional() }),
]);

export async function DELETE(request: NextRequest) {
  const { supabase, user } = await authBuyer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cart operation" }, { status: 400 });
  }

  const { error } = "clear" in parsed.data && parsed.data.clear
    ? await supabase.rpc("buyer_clear_cart")
    : await supabase.rpc("buyer_remove_cart_item", { p_cart_item_id: parsed.data.itemId });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Unable to update cart" },
      { status: error.code === "42501" ? 403 : 400 },
    );
  }

  try {
    const cart = await hydrateActiveCart(user.id);
    return NextResponse.json({ ok: true, cart });
  } catch (caught) {
    console.error("Cart delete succeeded but hydration failed", caught);
    return NextResponse.json({ ok: true, cart: null });
  }
}
