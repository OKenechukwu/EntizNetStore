import { notFound } from "next/navigation";
import CategoriesRow from "@/components/home/CategoriesRow";
import FeaturedSection from "@/components/home/FeaturedSection";
import { getCatalogCategory } from "@/lib/data/categories";
import { getProductsByCategory } from "@/lib/data/products";

export default async function CategoryPage({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;
  const category = await getCatalogCategory(slug);
  if (!category) notFound();

  const products = await getProductsByCategory(category.id, "entiznetstore", 50);
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
      <header className="border-b border-white/10 bg-card px-4 py-10 text-center">
        <h1 className="text-3xl font-bold md:text-4xl">{category.name}</h1>
        {category.description && (
          <p className="mx-auto mt-3 max-w-2xl text-foreground/70">{category.description}</p>
        )}
      </header>

      <CategoriesRow />
      <FeaturedSection
        title={`${category.name} products`}
        items={items}
        viewAllHref="/categories"
      />
    </main>
  );
}
