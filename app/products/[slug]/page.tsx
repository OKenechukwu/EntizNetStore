// app/products/[slug]/page.tsx
import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getProductBySlug,
  getRelatedProducts,
  getFeaturedProducts,
  getSellerProducts,
} from "@/lib/data/products";
import { getSellerStorefrontSlug } from "@/lib/data/storefront";
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

async function getProductFromDb(slug: string): Promise<Product | null> {
  try {
    return await getProductBySlug(slug);
  } catch (err) {
    console.error("Failed to load product from database:", err);
    return null;
  }
}

async function getRecommendationsFromDb(productSlug: string): Promise<Product[]> {
  try {
    return await getRelatedProducts(productSlug, 8);
  } catch (err) {
    console.error("Failed to load recommendations:", err);
    return [];
  }
}

async function getSponsoredProductsDb(): Promise<Product[]> {
  try {
    return await getFeaturedProducts(6, "entiznetstore");
  } catch (err) {
    console.error("Failed to load sponsored products:", err);
    return [];
  }
}

async function getStoreProducts(storeId: string, excludeId: string): Promise<Product[]> {
  try {
    return await getSellerProducts(storeId, excludeId, 8);
  } catch (err) {
    console.error("Failed to load store products:", err);
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductFromDb(slug);

  if (!product) return { title: "Product Not Found" };

  return {
    title: `${product.title} | EntizNetStore`,
    description: product.description || product.title,
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductFromDb(slug);

  if (!product) notFound();

  const [recommendations, sponsored, storeProducts, canonicalStoreSlug] = await Promise.all([
    getRecommendationsFromDb(slug),
    getSponsoredProductsDb(),
    product.store ? getStoreProducts(product.store.id, product.id) : Promise.resolve([] as Product[]),
    product.store ? getSellerStorefrontSlug(product.store.id) : Promise.resolve(null),
  ]);

  return (
    <main className="min-h-screen w-full bg-background px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <ProductGallery images={product.images} productName={product.title} />
          </div>

          <div>
            <ProductInfoPanelClient product={product} />

            {product.store && (
              <div className="mt-6 border-t border-white/10 pt-6">
                <ChatSellerButton
                  sellerId={product.store.id}
                  productId={product.id}
                  productTitle={product.title}
                />
              </div>
            )}
          </div>
        </div>

        {sponsored.length > 0 && <SponsoredProductsRow products={sponsored} />}

        <ProductTabs product={product} recommendations={recommendations} />

        {product.store && canonicalStoreSlug && storeProducts.length > 0 && (
          <MoreFromStoreRow
            storeName={product.store.name}
            storeSlug={canonicalStoreSlug}
            products={storeProducts}
          />
        )}
      </div>
    </main>
  );
}
