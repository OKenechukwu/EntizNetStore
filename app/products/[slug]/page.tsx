// app/products/[slug]/page.tsx
import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getProductBySlug,
  getRelatedProducts,
  getFeaturedProducts,
  getSellerProducts,
} from "@/lib/data/products";
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
/* DB fetchers (Neon Postgres via lib/data/products) */
/* ---------------------------------- */
async function getProductFromDb(slug: string): Promise<Product | null> {
  try {
    return await getProductBySlug(slug);
  } catch (err) {
    console.error("Failed to load product from database:", err);
    return null;
  }
}

function getProductFromDemo(slug: string): Product | null {
  if (!/^demo-\d+$/i.test(slug)) return null;
  return DEMO_DB.find((p) => p.slug === slug) ?? null;
}

/* Recommendations for DB product */
async function getRecommendationsFromDb(productSlug: string): Promise<Product[]> {
  try {
    return await getRelatedProducts(productSlug, 8);
  } catch (err) {
    console.error("Failed to load recommendations:", err);
    return [];
  }
}

/* Recommendations for demo product */
function getRecommendationsFromDemo(currentSlug: string): Product[] {
  return DEMO_DB.filter((p) => p.slug !== currentSlug).slice(0, 8);
}

/* Sponsored (DB) */
async function getSponsoredProductsDb(): Promise<Product[]> {
  try {
    return await getFeaturedProducts(6);
  } catch (err) {
    console.error("Failed to load sponsored products:", err);
    return [];
  }
}

/* Sponsored (demo) */
function getSponsoredProductsDemo(): Product[] {
  return DEMO_DB.slice(0, 6);
}

/* More from store (DB only – demo has no store) */
async function getStoreProducts(storeId: string, excludeId: string): Promise<Product[]> {
  try {
    return await getSellerProducts(storeId, excludeId, 8);
  } catch (err) {
    console.error("Failed to load store products:", err);
    return [];
  }
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
    product = getProductFromDemo(params.slug);
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
