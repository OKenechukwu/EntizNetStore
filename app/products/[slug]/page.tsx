// app/products/[slug]/page.tsx
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProductGallery from "@/components/product/ProductGallery";
import ProductInfoPanelClient from "@/components/product/ProductInfoPanelClient";
import ProductTabs from "@/components/product/ProductTabs";
import SponsoredProductsRow from "@/components/product/SponsoredProductsRow";
import MoreFromStoreRow from "@/components/product/MoreFromStoreRow";
import ChatSellerButton from "@/components/product/ChatSellerButton";
import type { Product } from "@/types/product";
import { DEFAULT_RETURN_POLICY } from "@/types/product";

type Props = {
  params: { slug: string };
};

/* ---------------------------------- */
/* Demo fallback (handles /products/demo-1 .. demo-12) */
/* ---------------------------------- */
const DEMO_IMAGE = "/attached_assets/stock_images/luxury_adult_product_04d5ddeb.jpg";

const DEMO_DB = Array.from({ length: 12 }, (_, i) => {
  const idx = i + 1;
  const title = `Premium Product ${idx}`;
  return {
    id: `demo-${idx}`,
    slug: `demo-${idx}`,
    title,
    basePrice: Number((Math.random() * 100 + 20).toFixed(2)), // treated as BASE currency (USD)
    images: [{ url: DEMO_IMAGE }],
    description:
      "Elegant, premium-grade product crafted for comfort and quality. Designed to meet luxury standards and everyday usability.",
    brand: undefined as
      | {
          id: string;
          name: string;
          slug: string;
        }
      | undefined,
    rating: Number((Math.random() * 2 + 3).toFixed(1)), // 3.0 - 5.0
    reviewCount: Math.floor(Math.random() * 300),
    soldCount: Math.floor(Math.random() * 2000),
    stockRemaining: Math.floor(Math.random() * 50) + 5,
    shippingOrigin: {
      country: "United States",
      isOverseas: false,
    } as Product["shippingOrigin"],
    deliveryOptions: [
      {
        type: "standard",
        etaDaysMin: 3,
        etaDaysMax: 7,
        feeBase: 0,
      },
    ] as Product["deliveryOptions"],
    returnPolicy: DEFAULT_RETURN_POLICY as Product["returnPolicy"],
    store: undefined as Product["store"],
    category: "demo",
    originalBasePrice: undefined as number | undefined,
    longDescription:
      "Crafted with meticulous attention to detail, this premium item balances style, comfort, and durability. Ideal for discerning customers seeking quality.",
  } satisfies Partial<Product> as Product;
});

/* ---------------------------------- */
/* DB fetchers (Supabase) */
/* ---------------------------------- */
async function getProductFromDb(slug: string): Promise<Product | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id,
      slug,
      title,
      brand,
      images,
      basePrice,
      originalBasePrice,
      rating,
      reviewCount,
      soldCount,
      stockRemaining,
      description,
      category,
      store:store_id (
        id,
        name,
        slug
      )
    `
    )
    .eq("slug", slug)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    brand: data.brand
      ? {
          id: data.brand,
          name: data.brand,
          slug: data.brand.toLowerCase().replace(/\s+/g, "-"),
        }
      : undefined,
    images: Array.isArray(data.images)
      ? data.images.map((url: string) => ({ url }))
      : [{ url: data.images }],
    basePrice: data.basePrice,
    originalBasePrice: data.originalBasePrice ?? undefined,
    rating: data.rating ?? undefined,
    reviewCount: data.reviewCount ?? 0,
    soldCount: data.soldCount ?? 0,
    stockRemaining: data.stockRemaining ?? 0,
    description: data.description ?? "",
    category: data.category ?? "general",
    shippingOrigin: {
      country: "United States",
      isOverseas: false,
    },
    deliveryOptions: [
      {
        type: "standard",
        etaDaysMin: 3,
        etaDaysMax: 7,
        feeBase: 0, // Free shipping (tweak when you add real shipping)
      },
    ],
    returnPolicy: DEFAULT_RETURN_POLICY,
    store: data.store
      ? {
          id: data.store.id,
          name: data.store.name,
          slug: data.store.slug,
        }
      : undefined,
  };
}

function getProductFromDemo(slug: string): Product | null {
  if (!/^demo-\d+$/i.test(slug)) return null;
  return DEMO_DB.find((p) => p.slug === slug) ?? null;
}

/* Recommendations for DB product */
async function getRecommendationsFromDb(productSlug: string): Promise<Product[]> {
  const supabase = createClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, category")
    .eq("slug", productSlug)
    .single();

  if (!product) return [];

  const { data, error } = await supabase
    .from("products")
    .select("id, slug, title, basePrice, images, brand, rating, reviewCount")
    .eq("category", product.category)
    .neq("id", product.id)
    .limit(8);

  if (error || !data) return [];

  return data.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    basePrice: p.basePrice,
    images: Array.isArray(p.images) ? p.images.map((url: string) => ({ url })) : [{ url: p.images }],
    brand: p.brand
      ? { id: p.brand, name: p.brand, slug: p.brand.toLowerCase().replace(/\s+/g, "-") }
      : undefined,
    rating: (p as any).rating ?? undefined,
    reviewCount: (p as any).reviewCount ?? 0,
  }));
}

/* Recommendations for demo product */
function getRecommendationsFromDemo(currentSlug: string): Product[] {
  return DEMO_DB.filter((p) => p.slug !== currentSlug).slice(0, 8);
}

/* Sponsored (DB) */
async function getSponsoredProductsDb(): Promise<Product[]> {
  const supabase = createClient();

  const { data } = await supabase
    .from("products")
    .select("id, slug, title, images, basePrice, brand")
    .limit(6);

  if (!data) return [];

  return data.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    images: Array.isArray(p.images) ? p.images.map((url: string) => ({ url })) : [{ url: p.images }],
    basePrice: p.basePrice,
    brand: p.brand
      ? { id: p.brand, name: p.brand, slug: p.brand.toLowerCase().replace(/\s+/g, "-") }
      : undefined,
  }));
}

/* Sponsored (demo) */
function getSponsoredProductsDemo(): Product[] {
  return DEMO_DB.slice(0, 6);
}

/* More from store (DB only – demo has no store) */
async function getStoreProducts(storeId: string, excludeId: string): Promise<Product[]> {
  const supabase = createClient();

  const { data } = await supabase
    .from("products")
    .select("id, slug, title, images, basePrice, brand")
    .eq("store_id", storeId)
    .neq("id", excludeId)
    .limit(8);

  if (!data) return [];

  return data.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    images: Array.isArray(p.images) ? p.images.map((url: string) => ({ url })) : [{ url: p.images }],
    basePrice: p.basePrice,
    brand: p.brand
      ? { id: p.brand, name: p.brand, slug: p.brand.toLowerCase().replace(/\s+/g, "-") }
      : undefined,
  }));
}

/* ---------------------------------- */
/* Metadata */
/* ---------------------------------- */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Prefer DB; if missing, try demo
  const db = await getProductFromDb(params.slug);
  const prod = db ?? getProductFromDemo(params.slug);

  if (!prod) {
    return { title: "Product Not Found" };
  }

  return {
    title: `${prod.title} | EntizNetStore`,
    description: prod.description || prod.title,
  };
}

/* ---------------------------------- */
/* Page */
/* ---------------------------------- */
export default async function ProductPage({ params }: Props) {
  // 1) Try real DB
  let product = await getProductFromDb(params.slug);

  // 2) Fallback to demo if DB not found
  const isDemo = !product;
  if (!product) {
    product = getProductFromDemo(params.slug) ?? undefined;
  }

  if (!product) {
    // Neither DB nor demo had this slug
    notFound();
  }

  // Data for rows/tabs
  const [recommendations, sponsored, storeProducts] = await Promise.all([
    isDemo ? Promise.resolve(getRecommendationsFromDemo(params.slug)) : getRecommendationsFromDb(params.slug),
    isDemo ? Promise.resolve(getSponsoredProductsDemo()) : getSponsoredProductsDb(),
    product!.store ? getStoreProducts(product!.store.id, product!.id) : Promise.resolve([] as Product[]),
  ]);

  return (
    <main className="min-h-screen w-full bg-background px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Main 2-column layout */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left: Gallery */}
          <div>
            <ProductGallery images={product!.images} productName={product!.title} />
          </div>

          {/* Right: Info Panel (client handles currency / locale) */}
          <div>
            <ProductInfoPanelClient product={product!} />

            {/* Chat Seller (hidden for demo since no store) */}
            {product!.store && (
              <div className="mt-6 border-t border-white/10 pt-6">
                <ChatSellerButton
                  sellerId={product!.store.id}
                  productId={product!.id}
                  productTitle={product!.title}
                />
              </div>
            )}
          </div>
        </div>

        {/* Sponsored Products */}
        {sponsored.length > 0 && <SponsoredProductsRow products={sponsored} />}

        {/* Tabs: description + recommendations */}
        <ProductTabs product={product!} recommendations={recommendations} />

        {/* More from Store (DB only) */}
        {product!.store && storeProducts.length > 0 && (
          <MoreFromStoreRow
            storeName={product!.store.name}
            storeSlug={product!.store.slug}
            products={storeProducts}
          />
        )}
      </div>
    </main>
  );
}
