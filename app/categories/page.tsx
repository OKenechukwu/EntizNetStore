import Image from "next/image";
import Link from "next/link";
import ProductSearchBar from "@/components/search/ProductSearchBar";
import { getCatalogCategories } from "@/lib/data/categories";

export default async function CategoriesPage() {
  const categories = await getCatalogCategories("entiznetstore");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <header className="mx-auto mb-8 max-w-2xl text-center">
          <h1 className="text-3xl font-bold md:text-4xl">Product Categories</h1>
          <p className="mt-3 text-foreground/70">
            Browse active EntizNetStore categories and products published by verified sellers.
          </p>
        </header>

        <div className="mx-auto mb-10 max-w-3xl">
          <ProductSearchBar
            placeholder="Search for products, categories, or brands…"
            className="max-w-3xl"
          />
        </div>

        {categories.length === 0 ? (
          <section className="rounded-xl border border-white/10 bg-card p-10 text-center">
            <h2 className="text-xl font-semibold">No categories published yet</h2>
            <p className="mt-2 text-sm text-foreground/60">
              Categories will appear here after they are activated in the catalog.
            </p>
            <Link href="/store" className="mt-6 inline-block text-brand-secondary hover:underline">
              Browse all products
            </Link>
          </section>
        ) : (
          <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className="group overflow-hidden rounded-xl border border-white/10 bg-card transition hover:-translate-y-0.5 hover:border-brand-secondary/50"
              >
                {category.imageUrl && (
                  <div className="relative aspect-[16/8] bg-muted">
                    <Image
                      src={category.imageUrl}
                      alt={category.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-xl font-semibold">{category.name}</h2>
                    <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs">
                      {category.productCount} {category.productCount === 1 ? "product" : "products"}
                    </span>
                  </div>
                  {category.description && (
                    <p className="mt-3 line-clamp-3 text-sm text-foreground/65">
                      {category.description}
                    </p>
                  )}
                  <p className="mt-5 text-sm font-medium text-brand-secondary">Browse category →</p>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
