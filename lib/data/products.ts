// lib/data/products.ts
// Server-side product data access against the live Neon Postgres database.
// See lib/db.ts for the source-of-truth policy.
import { query } from "@/lib/db";
import type { Product } from "@/types/product";
import { DEFAULT_RETURN_POLICY } from "@/types/product";

export const PLACEHOLDER_IMAGE =
  "/attached_assets/stock_images/luxury_adult_product_04d5ddeb.jpg";

/** Raw summary row shared by list-style queries. */
type SummaryRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  base_price: string | number;
  compare_at_price: string | number | null;
  marketplace_brand: string | null;
  image_url: string | null;
  rating: string | number | null;
  review_count: string | number;
};

const SUMMARY_SELECT = `
  p.id, p.slug, p.title, p.description, p.base_price, p.compare_at_price,
  p.marketplace_brand,
  (SELECT m.url FROM product_media m
    WHERE m.product_id = p.id
    ORDER BY m.position NULLS LAST, m.created_at
    LIMIT 1) AS image_url,
  (SELECT AVG(r.rating)::numeric(3,2) FROM reviews r
    WHERE r.product_id = p.id AND r.status = 'approved') AS rating,
  (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS review_count
`;

function toProductSummary(row: SummaryRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    basePrice: Number(row.base_price),
    originalBasePrice:
      row.compare_at_price != null ? Number(row.compare_at_price) : undefined,
    images: [{ url: row.image_url ?? PLACEHOLDER_IMAGE }],
    brand: row.marketplace_brand
      ? {
          id: row.marketplace_brand,
          name: row.marketplace_brand,
          slug: row.marketplace_brand.toLowerCase().replace(/\s+/g, "-"),
        }
      : undefined,
    rating: row.rating != null ? Number(row.rating) : undefined,
    reviewCount: Number(row.review_count ?? 0),
    description: row.description ?? "",
  } as Product;
}

/** Full product detail for the product page, including seller "store" info. */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  const rows = await query<
    SummaryRow & {
      seller_id: string | null;
      short_description: string | null;
      storefront_name: string | null;
      stock_remaining: string | number | null;
      sold_count: string | number;
    }
  >(
    `SELECT ${SUMMARY_SELECT},
       p.seller_id, p.short_description,
       ps.storefront_name,
       (SELECT SUM(v.inventory_quantity) FROM product_variants v
         WHERE v.product_id = p.id AND v.is_active) AS stock_remaining,
       (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi
         WHERE oi.product_id = p.id) AS sold_count
     FROM products p
     LEFT JOIN profiles_seller ps ON ps.id = p.seller_id
     WHERE p.slug = $1 AND p.status = 'active'
     LIMIT 1`,
    [slug]
  );
  const row = rows[0];
  if (!row) return null;

  const summary = toProductSummary(row);
  return {
    ...summary,
    soldCount: Number(row.sold_count ?? 0),
    stockRemaining:
      row.stock_remaining != null ? Number(row.stock_remaining) : 0,
    category: row.marketplace_brand ?? "general",
    shippingOrigin: { country: "United States", isOverseas: false },
    deliveryOptions: [
      { type: "standard", etaDaysMin: 3, etaDaysMax: 7, feeBase: 0 },
    ],
    returnPolicy: DEFAULT_RETURN_POLICY,
    store: row.seller_id
      ? {
          id: row.seller_id,
          name: row.storefront_name ?? "Seller store",
          // /store/[slug] resolves either a seller UUID or a slug derived
          // from the storefront name (see getStorefront).
          slug: row.storefront_name
            ? row.storefront_name.trim().toLowerCase().replace(/\s+/g, "-")
            : row.seller_id,
        }
      : undefined,
  } as Product;
}

/** Products related to the given one (same marketplace brand). */
export async function getRelatedProducts(
  slug: string,
  limit = 8
): Promise<Product[]> {
  const rows = await query<SummaryRow>(
    `SELECT ${SUMMARY_SELECT}
     FROM products p
     WHERE p.status = 'active'
       AND p.slug <> $1
       AND p.marketplace_brand = (SELECT marketplace_brand FROM products WHERE slug = $1)
     ORDER BY p.created_at DESC
     LIMIT $2`,
    [slug, limit]
  );
  return rows.map(toProductSummary);
}

/** Generic featured/sponsored products. */
export async function getFeaturedProducts(limit = 6): Promise<Product[]> {
  const rows = await query<SummaryRow>(
    `SELECT ${SUMMARY_SELECT}
     FROM products p
     WHERE p.status = 'active'
     ORDER BY p.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map(toProductSummary);
}

/** Other active products from the same seller (public storefront row). */
export async function getSellerProducts(
  sellerId: string,
  excludeId?: string,
  limit = 8
): Promise<Product[]> {
  const rows = await query<SummaryRow>(
    `SELECT ${SUMMARY_SELECT}
     FROM products p
     WHERE p.status = 'active' AND p.seller_id = $1
       AND ($2::uuid IS NULL OR p.id <> $2::uuid)
     ORDER BY p.created_at DESC
     LIMIT $3`,
    [sellerId, excludeId ?? null, limit]
  );
  return rows.map(toProductSummary);
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
  const params: any[] = [];
  const where: string[] = [`p.status = 'active'`];

  if (opts.marketplaceBrand) {
    params.push(opts.marketplaceBrand);
    where.push(`p.marketplace_brand = $${params.length}`);
  }
  if (opts.queryText && opts.queryText.trim()) {
    params.push(`%${opts.queryText.trim()}%`);
    const i = params.length;
    params.push(opts.queryText.trim().toLowerCase());
    const j = params.length;
    where.push(
      `(p.title ILIKE $${i} OR p.description ILIKE $${i}
        OR $${j} = ANY(p.tags) OR $${j} = ANY(p.search_keywords))`
    );
  }
  if (opts.minPrice != null && opts.minPrice > 0) {
    params.push(opts.minPrice);
    where.push(`p.base_price >= $${params.length}`);
  }
  if (opts.maxPrice != null) {
    params.push(opts.maxPrice);
    where.push(`p.base_price <= $${params.length}`);
  }
  if (opts.onSale) {
    where.push(`p.compare_at_price IS NOT NULL`);
  }

  params.push(Math.min(opts.limit ?? 50, 100));
  const limitIdx = params.length;

  let sql = `SELECT ${SUMMARY_SELECT}, p.seller_id, p.created_at, p.updated_at, p.tags
     FROM products p
     WHERE ${where.join(" AND ")}
     ORDER BY p.created_at DESC
     LIMIT $${limitIdx}`;

  let rows = await query<SummaryRow & { created_at: string }>(sql, params);
  if (opts.minRating != null) {
    rows = rows.filter((r) => Number(r.rating ?? 0) >= opts.minRating!);
  }
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.title,
    title: r.title,
    description: r.description,
    base_price: Number(r.base_price),
    compare_at_price:
      r.compare_at_price != null ? Number(r.compare_at_price) : null,
    marketplace_brand: r.marketplace_brand,
    image_url: r.image_url ?? PLACEHOLDER_IMAGE,
    rating: r.rating != null ? Number(r.rating) : null,
    reviews_count: Number(r.review_count ?? 0),
    seller_id: (r as any).seller_id ?? null,
    created_at: (r as any).created_at,
  }));
}

/** Seller dashboard data (products w/ inventory + media, orders, reviews). */
export async function getSellerDashboardData(sellerId: string) {
  const [sellerProfileRows, products, orders, reviews] = await Promise.all([
    query(`SELECT * FROM profiles_seller WHERE id = $1 LIMIT 1`, [sellerId]),
    query(
      `SELECT p.id, p.title, p.marketplace_brand, p.status, p.base_price, p.created_at,
         COALESCE(
           (SELECT json_agg(json_build_object('inventory_quantity', v.inventory_quantity))
              FROM product_variants v WHERE v.product_id = p.id),
           '[]'::json) AS product_variants,
         COALESCE(
           (SELECT json_agg(json_build_object('url', m.url))
              FROM product_media m WHERE m.product_id = p.id),
           '[]'::json) AS product_media
       FROM products p
       WHERE p.seller_id = $1
       ORDER BY p.created_at DESC`,
      [sellerId]
    ),
    query(
      `SELECT o.id, o.order_number, o.status, o.total_cents, o.created_at,
         COALESCE(
           (SELECT json_agg(json_build_object('product_title', oi.product_title, 'quantity', oi.quantity))
              FROM order_items oi WHERE oi.order_id = o.id),
           '[]'::json) AS order_items
       FROM orders o
       WHERE o.seller_id = $1
       ORDER BY o.created_at DESC
       LIMIT 10`,
      [sellerId]
    ),
    query(
      `SELECT r.id, r.rating, r.title, r.content, r.created_at,
         json_build_object('title', p.title, 'marketplace_brand', p.marketplace_brand) AS products
       FROM reviews r
       JOIN products p ON p.id = r.product_id
       WHERE p.seller_id = $1
       ORDER BY r.created_at DESC
       LIMIT 5`,
      [sellerId]
    ),
  ]);
  return {
    sellerProfile: sellerProfileRows[0] ?? null,
    products,
    orders,
    reviews,
  };
}

/** Public storefront: seller profile + paged active products. */
export async function getStorefront(
  sellerIdOrSlug: string,
  opts: { q?: string; page?: number; pageSize?: number } = {}
) {
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      sellerIdOrSlug
    );

  // Public storefront identifier: seller UUID, or a slug derived from the
  // storefront name (Neon has no persisted store_slug column).
  const slugExpr = `lower(regexp_replace(trim(storefront_name), '\\s+', '-', 'g'))`;
  const sellers = await query(
    isUuid
      ? `SELECT id, storefront_name, bio, logo_url, banner_url,
                ${slugExpr} AS store_slug
         FROM profiles_seller WHERE id = $1 LIMIT 1`
      : `SELECT id, storefront_name, bio, logo_url, banner_url,
                ${slugExpr} AS store_slug
         FROM profiles_seller WHERE ${slugExpr} = lower($1) LIMIT 1`,
    [sellerIdOrSlug]
  );
  const seller = sellers[0];
  if (!seller) return null;

  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(opts.pageSize ?? 24, 100);
  const like = `%${(opts.q ?? "").trim()}%`;

  const [countRows, products] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM products
       WHERE seller_id = $1 AND status = 'active' AND title ILIKE $2`,
      [seller.id, like]
    ),
    query(
      `SELECT p.id, p.title, p.base_price AS price, p.status, p.created_at, p.slug,
         (SELECT m.url FROM product_media m WHERE m.product_id = p.id
           ORDER BY m.position NULLS LAST LIMIT 1) AS image_url
       FROM products p
       WHERE p.seller_id = $1 AND p.status = 'active' AND p.title ILIKE $2
       ORDER BY p.created_at DESC
       LIMIT $3 OFFSET $4`,
      [seller.id, like, pageSize, (page - 1) * pageSize]
    ),
  ]);

  return {
    seller,
    products: products.map((p: any) => ({
      ...p,
      price: Number(p.price),
      image_url: p.image_url ?? PLACEHOLDER_IMAGE,
    })),
    count: Number(countRows[0]?.count ?? 0),
  };
}
