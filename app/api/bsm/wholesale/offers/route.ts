import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

const incoterm = z.enum([
  "EXW",
  "FCA",
  "CPT",
  "CIP",
  "DAP",
  "DPU",
  "DDP",
  "FAS",
  "FOB",
  "CFR",
  "CIF",
]);

const saveOfferSchema = z.object({
  offerId: z.string().uuid().nullable().optional(),
  productId: z.string().uuid(),
  variantId: z.string().uuid(),
  status: z.enum(["draft", "active", "paused", "archived"]),
  minimumOrderQuantity: z.number().int().min(1).max(100000),
  orderMultiple: z.number().int().min(1).max(100000),
  unitLabel: z.string().trim().min(1).max(40),
  casePackSize: z.number().int().min(1).max(100000).nullable().optional(),
  leadTimeDays: z.number().int().min(0).max(365),
  incoterm: incoterm.nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  tiers: z.array(z.object({
    minimumQuantity: z.number().int().min(1).max(100000),
    unitPriceCents: z.number().int().min(1).max(100000000000),
  })).min(1).max(20),
});

async function authBusiness() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await authBusiness();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: offers, error: offersError } = await supabase
    .from("wholesale_offers")
    .select("id, product_id, variant_id, status, currency, minimum_order_quantity, order_multiple, unit_label, case_pack_size, lead_time_days, incoterm, starts_at, ends_at, created_at, updated_at")
    .eq("seller_id", user.id)
    .order("updated_at", { ascending: false });

  if (offersError) {
    return NextResponse.json(
      { error: offersError.message || "Unable to load wholesale offers" },
      { status: offersError.code === "42501" ? 403 : 400 },
    );
  }

  const offerIds = (offers || []).map((offer) => offer.id);
  const productIds = Array.from(new Set((offers || []).map((offer) => offer.product_id)));
  const variantIds = Array.from(new Set((offers || []).map((offer) => offer.variant_id)));

  const [tiersResult, productsResult, variantsResult] = await Promise.all([
    offerIds.length
      ? supabase
          .from("wholesale_offer_tiers")
          .select("offer_id, minimum_quantity, unit_price_cents")
          .in("offer_id", offerIds)
          .order("minimum_quantity", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    productIds.length
      ? supabase.from("products").select("id, title, status, moderation_status").in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
    variantIds.length
      ? supabase.from("product_variants").select("id, title, sku, is_active, inventory_quantity").in("id", variantIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (tiersResult.error || productsResult.error || variantsResult.error) {
    console.error("Unable to hydrate wholesale seller offers", {
      tiers: tiersResult.error,
      products: productsResult.error,
      variants: variantsResult.error,
    });
    return NextResponse.json({ error: "Unable to load wholesale offer details" }, { status: 500 });
  }

  const tiersByOffer = new Map<string, Array<{ minimumQuantity: number; unitPriceCents: number }>>();
  for (const tier of tiersResult.data || []) {
    const current = tiersByOffer.get(tier.offer_id) || [];
    current.push({
      minimumQuantity: Number(tier.minimum_quantity),
      unitPriceCents: Number(tier.unit_price_cents),
    });
    tiersByOffer.set(tier.offer_id, current);
  }
  const productMap = new Map((productsResult.data || []).map((product) => [product.id, product]));
  const variantMap = new Map((variantsResult.data || []).map((variant) => [variant.id, variant]));

  return NextResponse.json({
    offers: (offers || []).map((offer) => ({
      id: offer.id,
      productId: offer.product_id,
      variantId: offer.variant_id,
      status: offer.status,
      currency: offer.currency,
      minimumOrderQuantity: offer.minimum_order_quantity,
      orderMultiple: offer.order_multiple,
      unitLabel: offer.unit_label,
      casePackSize: offer.case_pack_size,
      leadTimeDays: offer.lead_time_days,
      incoterm: offer.incoterm,
      startsAt: offer.starts_at,
      endsAt: offer.ends_at,
      createdAt: offer.created_at,
      updatedAt: offer.updated_at,
      product: productMap.get(offer.product_id) || null,
      variant: variantMap.get(offer.variant_id) || null,
      tiers: tiersByOffer.get(offer.id) || [],
    })),
  });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await authBusiness();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = saveOfferSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid wholesale offer" },
      { status: 400 },
    );
  }

  const offer = parsed.data;
  const { data, error } = await supabase.rpc("business_save_wholesale_offer", {
    p_offer_id: offer.offerId || null,
    p_product_id: offer.productId,
    p_variant_id: offer.variantId,
    p_status: offer.status,
    p_minimum_order_quantity: offer.minimumOrderQuantity,
    p_order_multiple: offer.orderMultiple,
    p_unit_label: offer.unitLabel,
    p_case_pack_size: offer.casePackSize ?? null,
    p_lead_time_days: offer.leadTimeDays,
    p_incoterm: offer.incoterm ?? null,
    p_starts_at: offer.startsAt ?? null,
    p_ends_at: offer.endsAt ?? null,
    p_tiers: offer.tiers,
  });

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Unable to save wholesale offer" },
      { status: error?.code === "42501" ? 403 : 400 },
    );
  }

  return NextResponse.json({ offerId: data }, { status: offer.offerId ? 200 : 201 });
}
