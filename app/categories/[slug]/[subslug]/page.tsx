import Link from "next/link";
import { notFound } from "next/navigation";
import FeaturedSection from "@/components/home/FeaturedSection";
import { getCatalogCategory } from "@/lib/data/categories";
import { getProductsByCategory } from "@/lib/data/products";

type Props = { params: Promise<{ slug: string; subslug: string }> };

export async function generateMetadata({ params }: Props) {
  const { subslug } = await params;
  const category = await getCatalogCategory(subslug);
  return category
    ? {
        title: `${category.name} | EntizNetStore`,
        description: category.description || `Shop ${category.name} at EntizNetStore.`,
      }
    : { title: "Category Not Found | EntizNetStore" };
}

export default async function SubcategoryPage({ params }: Props) {
  const { slug, subslug } = await params;
  const [parent, category] = await Promise.all([
    getCatalogCategory(slug),
    getCatalogCategory(subslug),
  ]);
  if (!parent || !category || category.parent_id !== parent.id) notFound();

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
    <main className="min-h-screen bg-background py-8 text-foreground">
      <nav className="mx-auto max-w-7xl px-4 text-sm text-foreground/60">
        <Link href="/categories" className="hover:underline">Categories</Link>
        <span className="mx-2">/</span>
        <Link href={`/categories/${parent.slug}`} className="hover:underline">{parent.name}</Link>
        <span className="mx-2">/</span>
        <span>{category.name}</span>
      </nav>
      <header className="mx-auto max-w-3xl px-4 py-8 text-center">
        <h1 className="text-3xl font-bold md:text-4xl">{category.name}</h1>
        {category.description && <p className="mt-3 text-foreground/65">{category.description}</p>}
      </header>
      <FeaturedSection title={`${category.name} products`} items={items} viewAllHref="/categories" />
    </main>
  );
}
