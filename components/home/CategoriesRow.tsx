import Link from "next/link";
import { Package } from "lucide-react";
import { T } from "@/components/i18n/I18nProvider";
import { getCatalogCategories } from "@/lib/data/categories";

export default async function CategoriesRow() {
  const categories = await getCatalogCategories("entiznetstore");

  return (
    <section className="w-full bg-background px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-secondary">
            <T k="common.shopByCategory" fallback="Shop by Category" />
          </h2>
          <p className="mt-1 text-sm text-foreground/70">
            <T k="common.exploreCurated" fallback="Explore our curated collections" />
          </p>
        </div>
        <Link href="/categories" className="text-sm font-medium text-brand-secondary hover:underline">
          View all →
        </Link>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-card p-6 text-center text-sm text-foreground/60">
          Categories will appear here when the catalog is published.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 md:gap-4">
          {categories.slice(0, 10).map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 p-4 transition hover:scale-[1.03] hover:border-brand-secondary/50 hover:bg-white/10"
            >
              <Package className="h-7 w-7 text-foreground/80 transition-colors group-hover:text-brand-secondary" />
              <span className="text-center text-xs font-medium text-foreground/90 group-hover:text-brand-secondary">
                {category.name}
              </span>
              <span className="text-[11px] text-foreground/50">{category.productCount} products</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
