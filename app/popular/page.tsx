import FeaturedSection from "@/components/home/FeaturedSection";
import { getFeaturedProducts } from "@/lib/data/products";

export default async function PopularPage() {
  // Until view/order analytics are collected, recent active products are the
  // only honest ranking signal available. Never fabricate popularity counts.
  const products = await getFeaturedProducts(24, "entiznetstore");
  const items = products.map((product) => ({
    id: product.id,
    title: product.title,
    price: product.basePrice,
    rating: product.rating,
    href: `/products/${product.slug}`,
    image: product.images[0]?.url,
  }));

  return (
    <main className="min-h-screen bg-background py-8 text-foreground">
      <header className="mx-auto max-w-3xl px-4 text-center">
        <h1 className="text-3xl font-bold md:text-4xl">Popular Products</h1>
        <p className="mt-3 text-foreground/65">
          Discover recently published products from the EntizNetStore marketplace.
        </p>
      </header>
      <FeaturedSection title="Latest marketplace products" items={items} viewAllHref="/store" />
    </main>
  );
}
