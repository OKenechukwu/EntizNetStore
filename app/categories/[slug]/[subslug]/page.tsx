import { notFound } from "next/navigation";
import Link from "next/link";
import { findSubcategoryBySlugs, getAllCategories } from "@/data/taxonomy";

type Props = { params: { slug: string; subslug: string } };

export async function generateStaticParams() {
  const params: { slug: string; subslug: string }[] = [];
  for (const c of getAllCategories()) {
    for (const s of c.sub ?? []) {
      params.push({ slug: c.slug, subslug: s.slug });
    }
  }
  return params;
}

export function generateMetadata({ params }: Props) {
  const found = findSubcategoryBySlugs(params.slug, params.subslug);
  const title = found
    ? `${found.sub.name} – ${found.cat.name} | EntizNetStore`
    : "Subcategory – EntizNetStore";
  const description = found
    ? `Shop ${found.sub.name} under ${found.cat.name} at EntizNetStore.`
    : "Browse subcategories on EntizNetStore.";
  return { title, description };
}

export default function SubcategoryPage({ params }: Props) {
  const found = findSubcategoryBySlugs(params.slug, params.subslug);
  if (!found) return notFound();

  const { cat, sub } = found;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-screen-2xl px-4 py-6">
        {/* Breadcrumbs */}
        <nav className="mb-4 text-sm text-foreground/70">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link href="/categories" className="hover:underline">
            Categories
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/categories/${cat.slug}`} className="hover:underline">
            {cat.name}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{sub.name}</span>
        </nav>

        <header className="mb-6">
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <span className="text-2xl">{cat.icon}</span>
            {sub.name}
          </h1>
          <p className="mt-1 text-sm text-foreground/80">
            Handpicked selection in <strong>{sub.name}</strong> from the{" "}
            {cat.name} collection.
          </p>
        </header>

        {/* Placeholder product grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
            >
              <div className="aspect-[4/3] bg-white/[0.06]" />
              <div className="p-3">
                <div className="text-sm font-semibold">
                  {sub.name} Item {i + 1}
                </div>
                <div className="text-xs text-foreground/70">
                  Premium • In stock
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
