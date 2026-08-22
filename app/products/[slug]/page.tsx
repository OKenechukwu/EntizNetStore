// app/products/[slug]/page.tsx
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProductBySlug,
  getRelatedProducts,
  getFeaturedProducts,
  getSellerProducts,
} from "@/lib/data/products";
import { getSellerStorefrontPublicDetails } from "@/lib/data/storefront";
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

  const [recommendations, sponsored, storeProducts, storefrontDetails] = await Promise.all([
    getRecommendationsFromDb(slug),
    getSponsoredProductsDb(),
    product.store ? getStoreProducts(product.store.id, product.id) : Promise.resolve([] as Product[]),
    product.store ? getSellerStorefrontPublicDetails(product.store.id) : Promise.resolve(null),
  ]);

  // Older data-access code supplied placeholder U.S. origin/free-delivery data.
  // M2 intentionally removes those claims. Public products must now have real
  // Seller return terms and, where shipping is required, a real shipping policy
  // before review can proceed.
  const displayProduct: Product = {
    ...product,
    shippingOrigin: undefined,
    deliveryOptions: undefined,
    returnPolicy: storefrontDetails?.returnPolicy
      ? {
          shortLabel: "Seller return policy",
          fullText: storefrontDetails.returnPolicy,
        }
      : undefined,
  };

  const canonicalStoreSlug = storefrontDetails?.storeSlug ?? null;

  return (
    <main className="min-h-screen w-full bg-background px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <ProductGallery images={displayProduct.images} productName={displayProduct.title} />
          </div>

          <div>
            <ProductInfoPanelClient product={displayProduct} />

            {storefrontDetails?.shippingPolicy ? (
              <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
                <h2 className="text-sm font-semibold">Seller shipping policy</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm opacity-75">
                  {storefrontDetails.shippingPolicy}
                </p>
              </div>
            ) : null}

            {displayProduct.store && (
              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-6">
                {canonicalStoreSlug ? (
                  <Link
                    href={`/store/${canonicalStoreSlug}`}
                    className="luxury-button-outline px-4 py-2 text-sm"
                  >
                    Visit {displayProduct.store.name}
                  </Link>
                ) : null}
                <ChatSellerButton
                  sellerId={displayProduct.store.id}
                  productId={displayProduct.id}
                  productTitle={displayProduct.title}
                />
              </div>
            )}
          </div>
        </div>

        {sponsored.length > 0 && <SponsoredProductsRow products={sponsored} />}

        <ProductTabs product={displayProduct} recommendations={recommendations} />

        {displayProduct.store && canonicalStoreSlug && storeProducts.length > 0 && (
          <MoreFromStoreRow
            storeName={displayProduct.store.name}
            storeSlug={canonicalStoreSlug}
            products={storeProducts}
          />
        )}
      </div>
    </main>
  );
}
