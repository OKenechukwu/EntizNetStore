import { createServerSupabase } from "@/lib/supabase/server";
import { PLACEHOLDER_IMAGE } from "@/lib/data/products";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type StorefrontOptions = {
  q?: string;
  page?: number;
  pageSize?: number;
};

type SellerRow = {
  id: string;
  storefront_name: string | null;
  store_slug: string;
  bio: string | null;
  logo_url: string | null;
  banner_url: string | null;
  shipping_policy: string | null;
  return_policy: string | null;
};

type ProductRow = {
  id: string;
  title: string;
  base_price: number | string;
  status: string;
  moderation_status: string;
  created_at: string;
  slug: string;
  product_media: Array<{ url: string; position: number | null }> | null;
};

function firstImage(row: ProductRow) {
  return [...(row.product_media ?? [])]
    .sort((a, b) => Number(a.position ?? Number.MAX_SAFE_INTEGER) - Number(b.position ?? Number.MAX_SAFE_INTEGER))[0]
    ?.url ?? PLACEHOLDER_IMAGE;
}

/** Canonical public identity/policies for a verified Seller storefront. */
export async function getSellerStorefrontPublicDetails(sellerId: string) {
  if (!UUID_RE.test(sellerId)) return null;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("profiles_seller")
    .select("store_slug, shipping_policy, return_policy")
    .eq("id", sellerId)
    .maybeSingle();

  if (error || !data?.store_slug) return null;
  return {
    storeSlug: data.store_slug as string,
    shippingPolicy: (data.shipping_policy as string | null) ?? null,
    returnPolicy: (data.return_policy as string | null) ?? null,
  };
}

export async function getSellerStorefrontSlug(sellerId: string) {
  return (await getSellerStorefrontPublicDetails(sellerId))?.storeSlug ?? null;
}

export async function getStorefrontByIdentity(
  sellerIdOrSlug: string,
  opts: StorefrontOptions = {},
) {
  const supabase = await createServerSupabase();
  const identity = sellerIdOrSlug.trim();
  if (!identity) return null;

  let sellerQuery = supabase
    .from("profiles_seller")
    .select("id, storefront_name, store_slug, bio, logo_url, banner_url, shipping_policy, return_policy")
    .limit(1);

  sellerQuery = UUID_RE.test(identity)
    ? sellerQuery.eq("id", identity)
    : sellerQuery.eq("store_slug", identity.toLowerCase());

  const { data: sellerData, error: sellerError } = await sellerQuery.maybeSingle();
  if (sellerError || !sellerData) return null;
  const seller = sellerData as SellerRow;

  const page = Math.max(1, Number.isFinite(opts.page) ? Number(opts.page) : 1);
  const pageSize = Math.max(1, Math.min(Number.isFinite(opts.pageSize) ? Number(opts.pageSize) : 24, 100));
  const search = (opts.q ?? "").trim();

  let countQuery = supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", seller.id)
    .eq("status", "active")
    .eq("moderation_status", "approved");

  let productsQuery = supabase
    .from("products")
    .select("id, title, base_price, status, moderation_status, created_at, slug, product_media(url, position)")
    .eq("seller_id", seller.id)
    .eq("status", "active")
    .eq("moderation_status", "approved");

  if (search) {
    countQuery = countQuery.ilike("title", `%${search}%`);
    productsQuery = productsQuery.ilike("title", `%${search}%`);
  }

  const [countRes, productsRes] = await Promise.all([
    countQuery,
    productsQuery
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1),
  ]);

  if (productsRes.error) {
    throw new Error("Unable to load storefront products");
  }

  return {
    seller,
    products: ((productsRes.data ?? []) as ProductRow[]).map((product) => ({
      id: product.id,
      title: product.title,
      price: Number(product.base_price),
      status: product.status,
      created_at: product.created_at,
      slug: product.slug,
      image_url: firstImage(product),
    })),
    count: countRes.count ?? 0,
    page,
    pageSize,
  };
}
