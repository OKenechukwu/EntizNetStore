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

type Props = {
  params: Promise<{ slug: string }>;
};

/* ---------------------------------- */
/* Canonical Supabase product fetchers */
/* ---------------------------------- */
async function getProductFromDb(slug: string): Promise<Product | null> {
  try {
    return await getProductBySlug(slug);
  } catch (err) {
    console.error("Failed to load product from database:", err);
    return null;
  }
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

/* Sponsored (DB) */
async function getSponsoredProductsDb(): Promise<Product[]> {
  try {
    return await getFeaturedProducts(6, "entiznetstore");
  } catch (err) {
    console.error("Failed to load sponsored products:", err);
    return [];
  }
}

/* More from store */
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
  const { slug } = await params;
  const prod = await getProductFromDb(slug);

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
  const { slug } = await params;
  const product = await getProductFromDb(slug);

  if (!product) {
    notFound();
  }

  // Data for rows/tabs
  const [recommendations, sponsored, storeProducts] = await Promise.all([
    getRecommendationsFromDb(slug),
    getSponsoredProductsDb(),
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

            {/* Chat Seller */}
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

        {/* More from Store */}
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
