import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hydrateActiveCart } from "@/lib/cart/server";

const quoteRequestSchema = z.object({
  addressId: z.string().uuid().nullable().optional(),
});

type AddressRow = {
  id: string;
  nickname: string | null;
  type: string;
  first_name: string;
  last_name: string;
  company: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state_province: string | null;
  postal_code: string;
  country: string;
  phone: string | null;
};

function addressSnapshot(address: AddressRow) {
  return {
    addressId: address.id,
    firstName: address.first_name,
    lastName: address.last_name,
    company: address.company,
    addressLine1: address.address_line1,
    addressLine2: address.address_line2,
    city: address.city,
    stateProvince: address.state_province,
    postalCode: address.postal_code,
    country: address.country,
    phone: address.phone,
  };
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = quoteRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid quote request" }, { status: 400 });
  }

  const { error: cartInitError } = await supabase.rpc("buyer_get_or_create_cart");
  if (cartInitError) {
    return NextResponse.json(
      { error: cartInitError.message || "Unable to initialize cart" },
      { status: cartInitError.code === "42501" ? 403 : 400 },
    );
  }

  let cart;
  try {
    cart = await hydrateActiveCart(user.id);
  } catch (error) {
    console.error("Unable to hydrate cart for quote", error);
    return NextResponse.json({ error: "Unable to quote cart" }, { status: 500 });
  }

  if (!cart || cart.items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const requiresShipping = cart.items.some((item) => item.requiresShipping);
  const hasTaxableItems = cart.items.some((item) => item.isTaxable);
  const blockReasons = new Set<string>();

  if (cart.hasUnavailableItems) blockReasons.add("cart_contains_unavailable_items");

  let address: AddressRow | null = null;
  if (parsed.data.addressId) {
    const { data, error } = await admin
      .from("addresses")
      .select("id, nickname, type, first_name, last_name, company, address_line1, address_line2, city, state_province, postal_code, country, phone")
      .eq("id", parsed.data.addressId)
      .eq("user_id", user.id)
      .in("type", ["shipping", "both"])
      .maybeSingle();

    if (error) {
      console.error("Unable to resolve quote address", error);
      return NextResponse.json({ error: "Unable to load shipping address" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Shipping address not found" }, { status: 404 });
    }
    address = data as AddressRow;
  }

  if (requiresShipping && !address) blockReasons.add("shipping_address_required");

  const shippingProvider = (process.env.SHIPPING_QUOTE_PROVIDER || "unconfigured").trim().toLowerCase();
  const taxProvider = (process.env.TAX_QUOTE_PROVIDER || "unconfigured").trim().toLowerCase();

  let shippingCents = 0;
  let taxCents = 0;

  const shippingQuote = requiresShipping
    ? shippingProvider === "unconfigured"
      ? { provider: "unconfigured", status: "blocked" }
      : { provider: shippingProvider, status: "unsupported" }
    : { provider: "internal", status: "not_required", amountCents: 0 };

  if (requiresShipping) {
    blockReasons.add(
      shippingProvider === "unconfigured"
        ? "shipping_quote_provider_unconfigured"
        : "shipping_quote_provider_not_implemented",
    );
  }

  const taxQuote = hasTaxableItems
    ? taxProvider === "unconfigured"
      ? { provider: "unconfigured", status: "blocked" }
      : { provider: taxProvider, status: "unsupported" }
    : { provider: "internal", status: "not_required", amountCents: 0 };

  if (hasTaxableItems) {
    blockReasons.add(
      taxProvider === "unconfigured"
        ? "tax_quote_provider_unconfigured"
        : "tax_quote_provider_not_implemented",
    );
  }

  const itemsSnapshot = cart.items.map((item) => ({
    cartItemId: item.id,
    productId: item.productId,
    variantId: item.variantId,
    sellerId: item.sellerId,
    title: item.title,
    variantTitle: item.variantTitle,
    sku: item.sku,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    lineTotalCents: item.lineTotalCents,
    requiresShipping: item.requiresShipping,
    isTaxable: item.isTaxable,
    available: item.available,
    availabilityReason: item.availabilityReason,
  }));

  const sellerTotals: Record<string, {
    subtotalCents: number;
    taxCents: number;
    shippingCents: number;
    discountCents: number;
    totalCents: number;
  }> = {};

  for (const item of cart.items) {
    if (!item.sellerId) {
      blockReasons.add("cart_contains_unavailable_items");
      continue;
    }
    const current = sellerTotals[item.sellerId] || {
      subtotalCents: 0,
      taxCents: 0,
      shippingCents: 0,
      discountCents: 0,
      totalCents: 0,
    };
    current.subtotalCents += item.lineTotalCents;
    current.totalCents += item.lineTotalCents;
    sellerTotals[item.sellerId] = current;
  }

  const discountCents = 0;
  const subtotalCents = cart.subtotalCents;
  const totalCents = subtotalCents + taxCents + shippingCents - discountCents;
  const status = blockReasons.size === 0 ? "ready" : "blocked";
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { data: quote, error: quoteError } = await admin
    .from("cart_quotes")
    .insert({
      cart_id: cart.id,
      buyer_id: user.id,
      cart_version: cart.version,
      status,
      block_reasons: Array.from(blockReasons),
      currency: "usd",
      subtotal_cents: subtotalCents,
      tax_cents: taxCents,
      shipping_cents: shippingCents,
      discount_cents: discountCents,
      total_cents: totalCents,
      shipping_address: address ? addressSnapshot(address) : null,
      shipping_quote: shippingQuote,
      tax_quote: taxQuote,
      items_snapshot: itemsSnapshot,
      seller_totals: sellerTotals,
      expires_at: expiresAt,
    })
    .select("id, cart_id, cart_version, status, block_reasons, currency, subtotal_cents, tax_cents, shipping_cents, discount_cents, total_cents, shipping_address, shipping_quote, tax_quote, items_snapshot, seller_totals, expires_at, created_at")
    .single();

  if (quoteError || !quote) {
    console.error("Unable to persist cart quote", quoteError);
    return NextResponse.json({ error: "Unable to create quote" }, { status: 500 });
  }

  return NextResponse.json({ quote });
}
