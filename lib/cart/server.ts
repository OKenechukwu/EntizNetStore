import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type CanonicalCartItem = {
  id: string;
  productId: string;
  variantId: string;
  sellerId: string | null;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  image: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  requiresShipping: boolean;
  isTaxable: boolean;
  available: boolean;
  availabilityReason: string | null;
  availableQuantity: number | null;
};

export type CanonicalCart = {
  id: string;
  version: number;
  status: string;
  currency: "usd";
  itemCount: number;
  subtotalCents: number;
  hasUnavailableItems: boolean;
  items: CanonicalCartItem[];
};

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
    .select("id, product_id, variant_id, quantity, created_at")
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

  const productIds = [...new Set(rawItems.map((item) => item.product_id))];
  const variantIds = [...new Set(rawItems.map((item) => item.variant_id))];

  const [{ data: products, error: productsError }, { data: variants, error: variantsError }] = await Promise.all([
    admin
      .from("products")
      .select("id, seller_id, title, status, moderation_status, requires_shipping, is_taxable")
      .in("id", productIds),
    admin
      .from("product_variants")
      .select("id, product_id, title, sku, price, is_active, track_inventory, inventory_quantity, inventory_policy")
      .in("id", variantIds),
  ]);

  if (productsError) throw productsError;
  if (variantsError) throw variantsError;

  const sellerIds = [...new Set((products || []).map((product) => product.seller_id).filter(Boolean))] as string[];

  const [{ data: sellers, error: sellersError }, { data: media, error: mediaError }, { data: reservations, error: reservationsError }] = await Promise.all([
    sellerIds.length
      ? admin.from("profiles_seller").select("id, verification_status").in("id", sellerIds)
      : Promise.resolve({ data: [], error: null }),
    productIds.length
      ? admin.from("product_media").select("product_id, url, position").in("product_id", productIds).eq("type", "image").order("position", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    variantIds.length
      ? admin.from("inventory_reservations").select("variant_id, quantity").in("variant_id", variantIds).eq("status", "pending").gt("expires_at", new Date().toISOString())
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (sellersError) throw sellersError;
  if (mediaError) throw mediaError;
  if (reservationsError) throw reservationsError;

  const productMap = new Map((products || []).map((product) => [product.id, product]));
  const variantMap = new Map((variants || []).map((variant) => [variant.id, variant]));
  const sellerMap = new Map((sellers || []).map((seller) => [seller.id, seller]));
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

  const items: CanonicalCartItem[] = rawItems.map((item) => {
    const product = productMap.get(item.product_id);
    const variant = variantMap.get(item.variant_id);
    const seller = product?.seller_id ? sellerMap.get(product.seller_id) : null;
    const quantity = Number(item.quantity);
    const unitPriceCents = variant ? Math.round(Number(variant.price) * 100) : 0;
    const reserved = reservedByVariant.get(item.variant_id) || 0;
    const availableQuantity = variant?.track_inventory && variant.inventory_policy === "deny"
      ? Math.max(Number(variant.inventory_quantity || 0) - reserved, 0)
      : null;

    let availabilityReason: string | null = null;
    if (!product || !variant) availabilityReason = "catalogue_item_missing";
    else if (product.status !== "active" || product.moderation_status !== "approved") availabilityReason = "product_unavailable";
    else if (seller?.verification_status !== "verified") availabilityReason = "seller_unavailable";
    else if (!variant.is_active) availabilityReason = "variant_unavailable";
    else if (availableQuantity !== null && availableQuantity < quantity) availabilityReason = "insufficient_inventory";

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
