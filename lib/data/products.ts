// lib/data/products.ts
// Server-side product data access against the canonical Supabase database.
// Public catalogue/storefront reads use the normal server (anon/session)
// client so RLS controls visibility — never the service role.
//
// Seller-dashboard orders/reviews return safe empty values until the
// production order/review implementation lands (Supabase tables are
// intentionally empty and deny-by-default; legacy Neon demo data must not
// be surfaced). Review aggregates and sold counts on public reads therefore
// resolve to empty/0 for now.
import { createServerSupabase } from "@/lib/supabase/server";
import type { Product } from "@/types/product";
import { DEFAULT_RETURN_POLICY } from "@/types/product";

export const PLACEHOLDER_IMAGE =
  "/attached_assets/stock_images/luxury_adult_product_04d5ddeb.jpg";

/** Embedded row shape shared by list-style queries. */
type SummaryRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  base_price: string | number;
  compare_at_price: string | number | null;
  marketplace_brand: string | null;
  product_media?: { url: string; position: number | null }[] | null;
  reviews?: { rating: number; status: string | null }[] | null;
};

const SUMMARY_COLS =
  "id, slug, title, description, base_price, compare_at_price, marketplace_brand, " +
  "product_media(url, position), reviews(rating, status)";

function firstImage(row: SummaryRow): string | null {
  const media = [...(row.product_media ?? [])].sort(
    (a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER)
  );
  return media[0]?.url ?? null;
}

function reviewStats(row: SummaryRow): { rating: number | null; count: number } {
  const all = row.reviews ?? [];
  const approved = all.filter((r) => r.status === "approved");
  const rating = approved.length
    ? Math.round((approved.reduce((s, r) => s + Number(r.rating), 0) / approved.length) * 100) / 100
    : null;
  return { rating, count: all.length };
}

function toProductSummary(row: SummaryRow): Product {
  const stats = reviewStats(row);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    basePrice: Number(row.base_price),
    originalBasePrice:
      row.compare_at_price != null ? Number(row.compare_at_price) : undefined,
    images: [{ url: firstImage(row) ?? PLACEHOLDER_IMAGE }],
    brand: row.marketplace_brand
      ? {
          id: row.marketplace_brand,
          name: row.marketplace_brand,
          slug: row.marketplace_brand.toLowerCase().replace(/\s+/g, "-"),
        }
      : undefined,
    rating: stats.rating != null ? stats.rating : undefined,
    reviewCount: stats.count,
    description: row.description ?? "",
  } as Product;
}

/** Full product detail for the product page, including seller "store" info. */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  const supabase = await createServerSupabase();
  const { data: row } = await supabase
    .from("products")
    .select(
      `${SUMMARY_COLS}, seller_id, short_description,
       profiles_seller(storefront_name),
       product_variants(id, title, price, inventory_quantity, inventory_policy, track_inventory, is_active, position)`
    )
    .eq("slug", slug)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!row) return null;

  const summary = toProductSummary(row as unknown as SummaryRow);
  const sellerId = (row as any).seller_id as string | null;
  const storefrontName =
    ((row as any).profiles_seller?.storefront_name as string | undefined) ?? null;
  const stockRemaining = ((row as any).product_variants ?? [])
    .filter((v: any) => v.is_active)
    .reduce((s: number, v: any) => s + Number(v.inventory_quantity ?? 0), 0);
  const variants = ((row as any).product_variants ?? [])
    .filter((variant: any) => variant.is_active)
    .sort((a: any, b: any) => Number(a.position ?? 0) - Number(b.position ?? 0))
    .map((variant: any) => ({
      id: variant.id,
      name: variant.title,
      priceDeltaBase: Number(variant.price) - summary.basePrice,
      stockRemaining:
        variant.track_inventory && variant.inventory_policy === "deny"
          ? Number(variant.inventory_quantity ?? 0)
          : undefined,
    }));

  return {
    ...summary,
    // order_items is deny-by-default in Supabase; sold count resolves to 0
    // until its RLS is separately approved.
    soldCount: 0,
    stockRemaining,
    variants,
    category: summary.brand?.name ?? "general",
    shippingOrigin: { country: "United States", isOverseas: false },
    deliveryOptions: [
      { type: "standard", etaDaysMin: 3, etaDaysMax: 7, feeBase: 0 },
    ],
    returnPolicy: DEFAULT_RETURN_POLICY,
    store: sellerId
      ? {
          id: sellerId,
          name: storefrontName ?? "Seller store",
          // /store/[slug] resolves either a seller UUID or a slug derived
          // from the storefront name (see getStorefront).
          slug: storefrontName
            ? storefrontName.trim().toLowerCase().replace(/\s+/g, "-")
            : sellerId,
        }
      : undefined,
  } as Product;
}

/** Products related to the given one (same marketplace brand). */
export async function getRelatedProducts(
  slug: string,
  limit = 8
): Promise<Product[]> {
  const supabase = await createServerSupabase();
  const { data: base } = await supabase
    .from("products")
    .select("marketplace_brand")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();
  if (!base?.marketplace_brand) return [];

  const { data } = await supabase
    .from("products")
    .select(SUMMARY_COLS)
    .eq("status", "active")
    .eq("marketplace_brand", base.marketplace_brand)
    .neq("slug", slug)
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as unknown as SummaryRow[]).map(toProductSummary);
}

/** Generic featured/sponsored products. */
export async function getFeaturedProducts(
  limit = 6,
  marketplaceBrand?: string,
): Promise<Product[]> {
  const supabase = await createServerSupabase();
  let query = supabase
    .from("products")
    .select(SUMMARY_COLS)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (marketplaceBrand) {
    query = query.eq("marketplace_brand", marketplaceBrand);
  }

  const { data } = await query;

  return ((data ?? []) as unknown as SummaryRow[]).map(toProductSummary);
}

/** Active products assigned to a canonical category. */
export async function getProductsByCategory(
  categoryId: string,
  marketplaceBrand = "entiznetstore",
  limit = 50,
): Promise<Product[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("product_categories")
    .select(`products!inner(${SUMMARY_COLS})`)
    .eq("category_id", categoryId)
    .eq("products.status", "active")
    .eq("products.marketplace_brand", marketplaceBrand)
    .limit(Math.min(limit, 100));

  return (data ?? [])
    .map((link: any) => link.products)
    .filter(Boolean)
    .map((row: unknown) => toProductSummary(row as SummaryRow));
}

/** Active products belonging to a catalog brand. */
export async function getProductsByBrand(
  brandId: string,
  marketplaceBrand = "entiznetstore",
  limit = 50,
): Promise<Product[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("products")
    .select(SUMMARY_COLS)
    .eq("brand_id", brandId)
    .eq("status", "active")
    .eq("marketplace_brand", marketplaceBrand)
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 100));

  return ((data ?? []) as unknown as SummaryRow[]).map(toProductSummary);
}

/** Other active products from the same seller (public storefront row). */
export async function getSellerProducts(
  sellerId: string,
  excludeId?: string,
  limit = 8
): Promise<Product[]> {
  const supabase = await createServerSupabase();
  let q = supabase
    .from("products")
    .select(SUMMARY_COLS)
    .eq("status", "active")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (excludeId) q = q.neq("id", excludeId);

  const { data } = await q;
  return ((data ?? []) as unknown as SummaryRow[]).map(toProductSummary);
}

/** Escape a value for use inside a PostgREST or() filter. */
function pgrstQuote(v: string): string {
  return `"${v.replace(/"/g, '')}"`;
}

/** Full-text-ish product search used by /api/search/products. */
export async function searchProducts(opts: {
  queryText?: string;
  marketplaceBrand?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  onSale?: boolean;
  limit?: number;
}) {
  const supabase = await createServerSupabase();
  let q = supabase
    .from("products")
    .select(`${SUMMARY_COLS}, seller_id, created_at, updated_at, tags`)
    .eq("status", "active");

  if (opts.marketplaceBrand) q = q.eq("marketplace_brand", opts.marketplaceBrand);
  if (opts.queryText && opts.queryText.trim()) {
    const term = opts.queryText.trim();
    const like = pgrstQuote(`%${term}%`);
    const kw = pgrstQuote(`{${term.toLowerCase()}}`);
    q = q.or(
      `title.ilike.${like},description.ilike.${like},tags.cs.${kw},search_keywords.cs.${kw}`
    );
  }
  if (opts.minPrice != null && opts.minPrice > 0) q = q.gte("base_price", opts.minPrice);
  if (opts.maxPrice != null) q = q.lte("base_price", opts.maxPrice);
  if (opts.onSale) q = q.not("compare_at_price", "is", null);

  q = q
    .order("created_at", { ascending: false })
    .limit(Math.min(opts.limit ?? 50, 100));

  const { data } = await q;
  let rows = (data ?? []) as unknown as (SummaryRow & {
    seller_id: string | null;
    created_at: string;
  })[];

  let mapped = rows.map((r) => {
    const stats = reviewStats(r);
    return {
      id: r.id,
      slug: r.slug,
      name: r.title,
      title: r.title,
      description: r.description,
      base_price: Number(r.base_price),
      compare_at_price:
        r.compare_at_price != null ? Number(r.compare_at_price) : null,
      marketplace_brand: r.marketplace_brand,
      image_url: firstImage(r) ?? PLACEHOLDER_IMAGE,
      rating: stats.rating,
      reviews_count: stats.count,
      seller_id: r.seller_id ?? null,
      created_at: r.created_at,
    };
  });

  if (opts.minRating != null) {
    mapped = mapped.filter((r) => Number(r.rating ?? 0) >= opts.minRating!);
  }
  if (opts.onSale) {
    mapped = mapped.filter(
      (r) =>
        r.compare_at_price != null &&
        Number(r.compare_at_price) > Number(r.base_price),
    );
  }
  return mapped;
}

/** Public storefront: seller profile + paged active products. */
export async function getStorefront(
  sellerIdOrSlug: string,
  opts: { q?: string; page?: number; pageSize?: number } = {}
) {
  const supabase = await createServerSupabase();
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      sellerIdOrSlug
    );

  const toSlug = (name: string | null) =>
    (name ?? "").trim().toLowerCase().replace(/\s+/g, "-");

  let seller: any = null;
  if (isUuid) {
    const { data } = await supabase
      .from("profiles_seller")
      .select("id, storefront_name, bio, logo_url, banner_url")
      .eq("id", sellerIdOrSlug)
      .limit(1)
      .maybeSingle();
    seller = data;
  } else {
    // No persisted store_slug column: match against the slug derived from the
    // storefront name. RLS already limits visible rows (own + verified).
    const { data } = await supabase
      .from("profiles_seller")
      .select("id, storefront_name, bio, logo_url, banner_url")
      .limit(1000);
    seller =
      (data ?? []).find((s) => toSlug(s.storefront_name) === sellerIdOrSlug.toLowerCase()) ??
      null;
  }
  if (!seller) return null;
  seller = { ...seller, store_slug: toSlug(seller.storefront_name) };

  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(opts.pageSize ?? 24, 100);
  const like = `%${(opts.q ?? "").trim()}%`;

  const [countRes, productsRes] = await Promise.all([
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", seller.id)
      .eq("status", "active")
      .ilike("title", like),
    supabase
      .from("products")
      .select("id, title, base_price, status, created_at, slug, product_media(url, position)")
      .eq("seller_id", seller.id)
      .eq("status", "active")
      .ilike("title", like)
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1),
  ]);

  return {
    seller,
    products: (productsRes.data ?? []).map((p: any) => ({
      id: p.id,
      title: p.title,
      price: Number(p.base_price),
      status: p.status,
      created_at: p.created_at,
      slug: p.slug,
      image_url: firstImage(p as SummaryRow) ?? PLACEHOLDER_IMAGE,
    })),
    count: countRes.count ?? 0,
  };
}
