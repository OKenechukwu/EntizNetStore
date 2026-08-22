import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hydrateActiveCart } from "@/lib/cart/server";

const importSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid().nullable().optional(),
    quantity: z.number().int().min(1).max(100),
  })).max(100),
});

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = importSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid cart import" },
      { status: 400 },
    );
  }

  const { error: cartError } = await supabase.rpc("buyer_get_or_create_cart");
  if (cartError) {
    return NextResponse.json({ error: cartError.message }, { status: 400 });
  }

  const current = await hydrateActiveCart(user.id);
  if (!current) {
    return NextResponse.json({ error: "Unable to initialize cart" }, { status: 500 });
  }

  // Never let a stale browser cart overwrite a persistent server cart that
  // already contains user choices.
  if (current.items.length > 0 || parsed.data.items.length === 0) {
    return NextResponse.json({ cart: current, imported: 0, rejected: [], skipped: current.items.length > 0 });
  }

  const admin = getSupabaseAdmin();
  const imported: string[] = [];
  const rejected: Array<{ productId: string; reason: string }> = [];

  for (const item of parsed.data.items) {
    let variantId = item.variantId || null;

    if (!variantId) {
      const { data: defaultVariant } = await admin
        .from("product_variants")
        .select("id")
        .eq("product_id", item.productId)
        .eq("is_active", true)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      variantId = defaultVariant?.id || null;
    }

    if (!variantId) {
      rejected.push({ productId: item.productId, reason: "variant_unavailable" });
      continue;
    }

    const { error } = await supabase.rpc("buyer_set_cart_item", {
      p_product_id: item.productId,
      p_variant_id: variantId,
      p_quantity: item.quantity,
    });

    if (error) {
      rejected.push({ productId: item.productId, reason: error.message || "unavailable" });
    } else {
      imported.push(item.productId);
    }
  }

  const cart = await hydrateActiveCart(user.id);
  return NextResponse.json({
    cart,
    imported: imported.length,
    rejected,
    skipped: false,
  });
}
