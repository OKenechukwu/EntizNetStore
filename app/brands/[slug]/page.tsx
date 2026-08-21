import Image from "next/image";
import { notFound } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import FeaturedSection from "@/components/home/FeaturedSection";
import { getCatalogBrand } from "@/lib/data/brands";
import { getProductsByBrand } from "@/lib/data/products";

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = await getCatalogBrand(slug);
  if (!brand) notFound();

  const products = await getProductsByBrand(brand.id, "entiznetstore", 50);
  const items = products.map((product) => ({
    id: product.id,
    title: product.title,
    price: product.basePrice,
    rating: product.rating,
    href: `/products/${product.slug}`,
    image: product.images[0]?.url,
  }));

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="relative overflow-hidden border-b border-white/10 bg-card px-4 py-12 text-center">
        {brand.banner_url && (
          <Image src={brand.banner_url} alt="" fill priority className="object-cover opacity-20" />
        )}
        <div className="relative mx-auto max-w-3xl">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-3xl font-bold md:text-4xl">{brand.name}</h1>
            {brand.is_verified && <BadgeCheck className="h-6 w-6 text-brand-secondary" aria-label="Verified" />}
          </div>
          {brand.description && <p className="mt-3 text-foreground/70">{brand.description}</p>}
        </div>
      </header>
      <FeaturedSection title={`${brand.name} products`} items={items} viewAllHref="/brands" />
    </main>
  );
}
