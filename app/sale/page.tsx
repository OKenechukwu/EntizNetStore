import FeaturedSection from "@/components/home/FeaturedSection";
import { searchProducts } from "@/lib/data/products";

export default async function SalePage() {
  const products = await searchProducts({
    marketplaceBrand: "entiznetstore",
    onSale: true,
    limit: 50,
  });
  const items = products.map((product) => ({
    id: product.id,
    title: product.title,
    price: product.base_price,
    rating: product.rating ?? undefined,
    href: `/products/${product.slug}`,
    image: product.image_url,
  }));

  return (
    <main className="min-h-screen bg-background py-8 text-foreground">
      <header className="mx-auto max-w-3xl px-4 text-center">
        <h1 className="text-3xl font-bold md:text-4xl">Products on Sale</h1>
        <p className="mt-3 text-foreground/65">
          Current discounts published by EntizNetStore sellers. Prices are read directly from the catalog.
        </p>
      </header>
      <FeaturedSection title="Current offers" items={items} viewAllHref="/store" />
    </main>
  );
}
