import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

const querySchema = z.object({
  q: z.string().trim().max(100).optional(),
  sellerId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(24),
});

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = querySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") || undefined,
    sellerId: request.nextUrl.searchParams.get("sellerId") || undefined,
    limit: request.nextUrl.searchParams.get("limit") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid wholesale catalogue query" }, { status: 400 });
  }

  let offersQuery = supabase
    .from("wholesale_offers")
    .select("id, seller_id, product_id, variant_id, currency, minimum_order_quantity, order_multiple, unit_label, case_pack_size, lead_time_days, incoterm, starts_at, ends_at, updated_at")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(parsed.data.limit);

  if (parsed.data.sellerId) offersQuery = offersQuery.eq("seller_id", parsed.data.sellerId);

  const { data: offers, error: offersError } = await offersQuery;
  if (offersError) {
    return NextResponse.json(
      { error: offersError.message || "Unable to load wholesale catalogue" },
      { status: offersError.code === "42501" ? 403 : 400 },
    );
  }

  const offerIds = (offers || []).map((offer) => offer.id);
  const productIds = Array.from(new Set((offers || []).map((offer) => offer.product_id)));
  const variantIds = Array.from(new Set((offers || []).map((offer) => offer.variant_id)));
  const sellerIds = Array.from(new Set((offers || []).map((offer) => offer.seller_id)));

  const [tiersResult, productsResult, variantsResult, businessesResult, mediaResult] = await Promise.all([
    offerIds.length
      ? supabase
          .from("wholesale_offer_tiers")
          .select("offer_id, minimum_quantity, unit_price_cents")
          .in("offer_id", offerIds)
          .order("minimum_quantity", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    productIds.length
      ? supabase
          .from("products")
          .select("id, title, slug, seller_id, requires_shipping")
          .in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
    variantIds.length
      ? supabase
          .from("product_variants")
          .select("id, title, sku, inventory_quantity, track_inventory, inventory_policy")
          .in("id", variantIds)
      : Promise.resolve({ data: [], error: null }),
    sellerIds.length
      ? supabase
          .from("profiles_business")
          .select("id, display_name, business_kind, logo_url, country")
          .in("id", sellerIds)
      : Promise.resolve({ data: [], error: null }),
    productIds.length
      ? supabase
          .from("product_media")
          .select("product_id, url, position")
          .in("product_id", productIds)
          .eq("type", "image")
          .order("position", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const hydrationError = tiersResult.error
    || productsResult.error
    || variantsResult.error
    || businessesResult.error
    || mediaResult.error;
  if (hydrationError) {
    console.error("Unable to hydrate wholesale catalogue", hydrationError);
    return NextResponse.json({ error: "Unable to load wholesale catalogue details" }, { status: 500 });
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
  const businessMap = new Map((businessesResult.data || []).map((business) => [business.id, business]));
  const imageMap = new Map<string, string>();
  for (const media of mediaResult.data || []) {
    if (!imageMap.has(media.product_id)) imageMap.set(media.product_id, media.url);
  }

  const normalizedQuery = parsed.data.q?.toLocaleLowerCase() || null;
  const hydrated = (offers || []).map((offer) => {
    const product = productMap.get(offer.product_id) || null;
    const variant = variantMap.get(offer.variant_id) || null;
    const seller = businessMap.get(offer.seller_id) || null;
    return {
      id: offer.id,
      sellerId: offer.seller_id,
      productId: offer.product_id,
      variantId: offer.variant_id,
      currency: offer.currency,
      minimumOrderQuantity: offer.minimum_order_quantity,
      orderMultiple: offer.order_multiple,
      unitLabel: offer.unit_label,
      casePackSize: offer.case_pack_size,
      leadTimeDays: offer.lead_time_days,
      incoterm: offer.incoterm,
      startsAt: offer.starts_at,
      endsAt: offer.ends_at,
      product,
      variant,
      seller,
      image: imageMap.get(offer.product_id) || null,
      tiers: tiersByOffer.get(offer.id) || [],
    };
  });

  const visible = normalizedQuery
    ? hydrated.filter((entry) => {
        const haystack = [
          entry.product?.title,
          entry.variant?.title,
          entry.variant?.sku,
          entry.seller?.display_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase();
        return haystack.includes(normalizedQuery);
      })
    : hydrated;

  return NextResponse.json({ offers: visible });
}
