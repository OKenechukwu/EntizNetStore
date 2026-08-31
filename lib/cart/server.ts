import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  CanonicalCart,
  CanonicalCartItem,
  PurchaseMode,
  WholesaleCartTerms,
} from "@/lib/cart/contracts";

const BUSINESS_VERIFIED = "verified";

async function capabilityIsActive(
  userId: string,
  capability: "buyer" | "seller" | "business",
): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("marketplace_capability_is_active", {
    p_user_id: userId,
    p_capability: capability,
  });
  if (error) throw error;
  return data === true;
}

function offerIsTimeActive(offer: { starts_at: string | null; ends_at: string | null }) {
  const now = Date.now();
  if (offer.starts_at && new Date(offer.starts_at).getTime() > now) return false;
  if (offer.ends_at && new Date(offer.ends_at).getTime() <= now) return false;
  return true;
}

export async function hydrateActiveCart(buyerId: string): Promise<CanonicalCart | null> {
  const admin = getSupabaseAdmin();

  const { data: cart, error: cartError } = await admin
    .from("carts")
    .select("id, buyer_id, status, currency, version")
    .eq("buyer_id", buyerId)
    .eq("status", "active")
    .maybeSingle();

  if (cartError) throw cartError;
  if (!cart) return null;

  const { data: cartItems, error: itemsError } = await admin
    .from("cart_items")
    .select("id, product_id, variant_id, quantity, purchase_mode, wholesale_offer_id, created_at")
    .eq("cart_id", cart.id)
    .order("created_at", { ascending: true });

  if (itemsError) throw itemsError;

  const rawItems = cartItems || [];
  if (rawItems.length === 0) {
    return {
      id: cart.id,
      version: Number(cart.version),
      status: cart.status,
      currency: "usd",
      itemCount: 0,
      subtotalCents: 0,
      hasUnavailableItems: false,
      items: [],
    };
  }

  const productIds = Array.from(new Set(rawItems.map((item) => item.product_id)));
  const variantIds = Array.from(new Set(rawItems.map((item) => item.variant_id)));
  const wholesaleOfferIds = Array.from(
    new Set(
      rawItems
        .filter((item) => item.purchase_mode === "wholesale" && item.wholesale_offer_id)
        .map((item) => item.wholesale_offer_id as string),
    ),
  );

  const [
    { data: products, error: productsError },
    { data: variants, error: variantsError },
    { data: offers, error: offersError },
    { data: tiers, error: tiersError },
    { data: buyerBusiness, error: buyerBusinessError },
  ] = await Promise.all([
    admin
      .from("products")
      .select("id, seller_id, title, status, moderation_status, requires_shipping, is_taxable")
      .in("id", productIds),
    admin
      .from("product_variants")
      .select("id, product_id, title, sku, price, is_active, track_inventory, inventory_quantity, inventory_policy")
      .in("id", variantIds),
    wholesaleOfferIds.length
      ? admin
          .from("wholesale_offers")
          .select("id, seller_id, product_id, variant_id, status, minimum_order_quantity, order_multiple, unit_label, case_pack_size, lead_time_days, incoterm, starts_at, ends_at")
          .in("id", wholesaleOfferIds)
      : Promise.resolve({ data: [], error: null }),
    wholesaleOfferIds.length
      ? admin
          .from("wholesale_offer_tiers")
          .select("offer_id, minimum_quantity, unit_price_cents")
          .in("offer_id", wholesaleOfferIds)
          .order("minimum_quantity", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    wholesaleOfferIds.length
      ? admin
          .from("profiles_business")
          .select("id, verification_status")
          .eq("id", buyerId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (productsError) throw productsError;
  if (variantsError) throw variantsError;
  if (offersError) throw offersError;
  if (tiersError) throw tiersError;
  if (buyerBusinessError) throw buyerBusinessError;

  const sellerIds = Array.from(
    new Set((products || []).map((product) => product.seller_id).filter(Boolean)),
  ) as string[];

  const [
    { data: sellers, error: sellersError },
    { data: sellerBusinesses, error: sellerBusinessesError },
    { data: media, error: mediaError },
    { data: reservations, error: reservationsError },
    buyerBusinessCapability,
    sellerCapabilityRows,
  ] = await Promise.all([
    sellerIds.length
      ? admin.from("profiles_seller").select("id, verification_status").in("id", sellerIds)
      : Promise.resolve({ data: [], error: null }),
    sellerIds.length
      ? admin.from("profiles_business").select("id, verification_status").in("id", sellerIds)
      : Promise.resolve({ data: [], error: null }),
    productIds.length
      ? admin
          .from("product_media")
          .select("product_id, url, position")
          .in("product_id", productIds)
          .eq("type", "image")
          .order("position", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    variantIds.length
      ? admin
          .from("inventory_reservations")
          .select("variant_id, quantity")
          .in("variant_id", variantIds)
          .eq("status", "pending")
          .gt("expires_at", new Date().toISOString())
      : Promise.resolve({ data: [], error: null }),
    wholesaleOfferIds.length ? capabilityIsActive(buyerId, "business") : Promise.resolve(false),
    Promise.all(
      sellerIds.map(async (sellerId) => ({
        sellerId,
        seller: await capabilityIsActive(sellerId, "seller"),
        business: wholesaleOfferIds.length
          ? await capabilityIsActive(sellerId, "business")
          : false,
      })),
    ),
  ]);

  if (sellersError) throw sellersError;
  if (sellerBusinessesError) throw sellerBusinessesError;
  if (mediaError) throw mediaError;
  if (reservationsError) throw reservationsError;

  const productMap = new Map((products || []).map((product) => [product.id, product]));
  const variantMap = new Map((variants || []).map((variant) => [variant.id, variant]));
  const sellerMap = new Map((sellers || []).map((seller) => [seller.id, seller]));
  const sellerBusinessMap = new Map(
    (sellerBusinesses || []).map((business) => [business.id, business]),
  );
  const sellerCapabilityMap = new Map(
    sellerCapabilityRows.map((entry) => [entry.sellerId, entry]),
  );
  const offerMap = new Map((offers || []).map((offer) => [offer.id, offer]));
  const tiersByOffer = new Map<string, Array<{ minimum_quantity: number; unit_price_cents: number }>>();
  for (const tier of tiers || []) {
    const current = tiersByOffer.get(tier.offer_id) || [];
    current.push({
      minimum_quantity: Number(tier.minimum_quantity),
      unit_price_cents: Number(tier.unit_price_cents),
    });
    tiersByOffer.set(tier.offer_id, current);
  }

  const imageMap = new Map<string, string>();
  for (const entry of media || []) {
    if (!imageMap.has(entry.product_id)) imageMap.set(entry.product_id, entry.url);
  }

  const reservedByVariant = new Map<string, number>();
  for (const reservation of reservations || []) {
    reservedByVariant.set(
      reservation.variant_id,
      (reservedByVariant.get(reservation.variant_id) || 0) + Number(reservation.quantity || 0),
    );
  }

  const buyerCanViewWholesale = Boolean(
    buyerBusiness?.verification_status === BUSINESS_VERIFIED && buyerBusinessCapability,
  );

  const items: CanonicalCartItem[] = rawItems.map((item) => {
    const product = productMap.get(item.product_id);
    const variant = variantMap.get(item.variant_id);
    const seller = product?.seller_id ? sellerMap.get(product.seller_id) : null;
    const sellerBusiness = product?.seller_id
      ? sellerBusinessMap.get(product.seller_id)
      : null;
    const sellerCapabilities = product?.seller_id
      ? sellerCapabilityMap.get(product.seller_id)
      : null;
    const quantity = Number(item.quantity);
    const purchaseMode: PurchaseMode = item.purchase_mode === "wholesale" ? "wholesale" : "retail";
    const offer = item.wholesale_offer_id ? offerMap.get(item.wholesale_offer_id) : null;
    const reserved = reservedByVariant.get(item.variant_id) || 0;
    const availableQuantity = variant?.track_inventory && variant.inventory_policy === "deny"
      ? Math.max(Number(variant.inventory_quantity || 0) - reserved, 0)
      : null;

    let availabilityReason: string | null = null;
    let unitPriceCents = variant ? Math.round(Number(variant.price) * 100) : 0;
    let wholesaleTerms: WholesaleCartTerms | null = null;

    if (!product || !variant) availabilityReason = "catalogue_item_missing";
    else if (product.status !== "active" || product.moderation_status !== "approved") availabilityReason = "product_unavailable";
    else if (seller?.verification_status !== "verified" || sellerCapabilities?.seller !== true) availabilityReason = "seller_unavailable";
    else if (!variant.is_active) availabilityReason = "variant_unavailable";

    if (purchaseMode === "wholesale" && availabilityReason === null) {
      const offerMatches = Boolean(
        offer
          && offer.id === item.wholesale_offer_id
          && offer.seller_id === product?.seller_id
          && offer.product_id === item.product_id
          && offer.variant_id === item.variant_id
          && offer.status === "active"
          && offerIsTimeActive(offer),
      );
      const sellerCanWholesale = Boolean(
        sellerBusiness?.verification_status === BUSINESS_VERIFIED
          && sellerCapabilities?.business === true,
      );

      if (!buyerCanViewWholesale) {
        availabilityReason = "verified_business_buyer_required";
        unitPriceCents = 0;
      } else if (!sellerCanWholesale || !offerMatches || !offer) {
        availabilityReason = "wholesale_offer_unavailable";
        unitPriceCents = 0;
      } else {
        const minimumOrderQuantity = Number(offer.minimum_order_quantity);
        const orderMultiple = Number(offer.order_multiple);
        const eligibleTier = (tiersByOffer.get(offer.id) || [])
          .filter((tier) => tier.minimum_quantity <= quantity)
          .sort((left, right) => right.minimum_quantity - left.minimum_quantity)[0];

        wholesaleTerms = {
          offerId: offer.id,
          tierMinimumQuantity: eligibleTier?.minimum_quantity || minimumOrderQuantity,
          minimumOrderQuantity,
          orderMultiple,
          unitLabel: offer.unit_label,
          casePackSize: offer.case_pack_size === null ? null : Number(offer.case_pack_size),
          leadTimeDays: Number(offer.lead_time_days),
          incoterm: offer.incoterm,
        };

        if (quantity < minimumOrderQuantity || ((quantity - minimumOrderQuantity) % orderMultiple) !== 0) {
          availabilityReason = "wholesale_quantity_does_not_meet_offer_terms";
        }
        if (!eligibleTier) {
          availabilityReason = "wholesale_pricing_tier_unavailable";
          unitPriceCents = 0;
        } else {
          unitPriceCents = eligibleTier.unit_price_cents;
        }
      }
    }

    if (availabilityReason === null && availableQuantity !== null && availableQuantity < quantity) {
      availabilityReason = "insufficient_inventory";
    }

    return {
      id: item.id,
      productId: item.product_id,
      variantId: item.variant_id,
      sellerId: product?.seller_id || null,
      title: product?.title || "Unavailable product",
      variantTitle: variant?.title || null,
      sku: variant?.sku || null,
      image: imageMap.get(item.product_id) || null,
      quantity,
      purchaseMode,
      wholesaleTerms,
      unitPriceCents,
      lineTotalCents: unitPriceCents * quantity,
      requiresShipping: Boolean(product?.requires_shipping),
      isTaxable: Boolean(product?.is_taxable),
      available: availabilityReason === null,
      availabilityReason,
      availableQuantity,
    };
  });

  return {
    id: cart.id,
    version: Number(cart.version),
    status: cart.status,
    currency: "usd",
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotalCents: items.reduce((sum, item) => sum + item.lineTotalCents, 0),
    hasUnavailableItems: items.some((item) => !item.available),
    items,
  };
}
