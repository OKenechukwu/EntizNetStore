// app/products/[slug]/page.tsx
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProductGallery from "@/components/product/ProductGallery";
import ProductInfoPanel from "@/components/product/ProductInfoPanel";
import ProductTabs from "@/components/product/ProductTabs";
import SponsoredProductsRow from "@/components/product/SponsoredProductsRow";
import MoreFromStoreRow from "@/components/product/MoreFromStoreRow";
import ChatSellerButton from "@/components/product/ChatSellerButton";
import ProductInfoPanelClient from "@/components/product/ProductInfoPanelClient";
import type { Product } from "@/types/product";
import { DEFAULT_RETURN_POLICY } from "@/types/product";

type Props = {
  params: { slug: string };
};

/**
 * Fetch product data from database
 */
async function getProduct(slug: string): Promise<Product | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("products")
    .select(`
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
    `)
    .eq("slug", slug)
    .single();

  if (error || !data) return null;

  // Transform to Product type
  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    brand: data.brand ? {
      id: data.brand,
      name: data.brand,
      slug: data.brand.toLowerCase().replace(/\s+/g, "-"),
    } : undefined,
    images: Array.isArray(data.images)
      ? data.images.map((url: string) => ({ url }))
      : [{ url: data.images }],
    basePrice: data.basePrice,
    originalBasePrice: data.originalBasePrice,
    rating: data.rating,
    reviewCount: data.reviewCount,
    soldCount: data.soldCount,
    stockRemaining: data.stockRemaining,
    description: data.description,
    shippingOrigin: {
      country: "United States",
      isOverseas: false,
    },
    deliveryOptions: [
      {
        type: "standard",
        etaDaysMin: 3,
        etaDaysMax: 7,
        feeBase: 0, // Free shipping
      },
    ],
    returnPolicy: DEFAULT_RETURN_POLICY,
    store: data.store ? {
      id: data.store.id,
      name: data.store.name,
      slug: data.store.slug,
    } : undefined,
  };
}

/**
 * Fetch recommendations based on category similarity
 */
async function getRecommendations(productSlug: string): Promise<Product[]> {
  const supabase = createClient();

  // Get the product to find its category
  const { data: product } = await supabase
    .from("products")
    .select("id, category")
    .eq("slug", productSlug)
    .single();

  if (!product) return [];

  // Get products in the same category (excluding current product)
  const { data, error } = await supabase
    .from("products")
    .select("id, slug, title, basePrice, images, brand, rating, reviewCount")
    .eq("category", product.category)
    .neq("id", product.id)
    .limit(8);

  if (error || !data) return [];

  // Transform to Product type
  return data.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    basePrice: p.basePrice,
    images: Array.isArray(p.images) ? p.images.map((url: string) => ({ url })) : [{ url: p.images }],
    brand: p.brand ? {
      id: p.brand,
      name: p.brand,
      slug: p.brand.toLowerCase().replace(/\s+/g, "-"),
    } : undefined,
    rating: p.rating,
    reviewCount: p.reviewCount,
  }));
}

/**
 * Fetch sponsored products (mock for now)
 */
async function getSponsoredProducts(): Promise<Product[]> {
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
    brand: p.brand ? {
      id: p.brand,
      name: p.brand,
      slug: p.brand.toLowerCase().replace(/\s+/g, "-"),
    } : undefined,
  }));
}

/**
 * Fetch more products from same store
 */
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
    brand: p.brand ? {
      id: p.brand,
      name: p.brand,
      slug: p.brand.toLowerCase().replace(/\s+/g, "-"),
    } : undefined,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct(params.slug);

  if (!product) {
    return {
      title: "Product Not Found",
    };
  }

  return {
    title: `${product.title} | EntizNetStore`,
    description: product.description || product.title,
  };
}

export default async function ProductPage({ params }: Props) {
  const product = await getProduct(params.slug);

  if (!product) {
    notFound();
  }

  const [recommendations, sponsored, storeProducts] = await Promise.all([
    getRecommendations(params.slug),
    getSponsoredProducts(),
    product.store ? getStoreProducts(product.store.id, product.id) : Promise.resolve([]),
  ]);

  return (
    <main className="min-h-screen w-full bg-background px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Main Product Section: 2-Column Layout */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left: Gallery */}
          <div>
            <ProductGallery images={product.images} productName={product.title} />
          </div>

          {/* Right: Info Panel */}
          <div>
            <ProductInfoPanelClient product={product} />
            
            {/* Chat Seller */}
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

        {/* Sponsored Products */}
        {sponsored.length > 0 && <SponsoredProductsRow products={sponsored} />}

        {/* Product Tabs */}
        <ProductTabs product={product} recommendations={recommendations} />

        {/* More from Store */}
        {product.store && storeProducts.length > 0 && (
          <MoreFromStoreRow
            storeName={product.store.name}
            storeSlug={product.store.slug}
            products={storeProducts}
          />
        )}
      </div>
    </main>
  );
}
