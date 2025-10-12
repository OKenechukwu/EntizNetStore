// app/categories/[slug]/page.tsx
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/layout/Header";
import Price from "@/components/common/Price";
import {
  findCategoryBySlug,
  getAllCategories,
  type Cat,
} from "@/data/taxonomy";

/* -------------------------------------------
   Static params + metadata
-------------------------------------------- */
export async function generateStaticParams() {
  return getAllCategories().map((c) => ({ slug: c.slug }));
}

type PageProps = {
  params: { slug: string };
  searchParams?: { sub?: string };
};

export async function generateMetadata({ params }: PageProps) {
  const cat = findCategoryBySlug(params.slug);
  if (!cat) return {};
  return {
    title: `${cat.name} | EntizNetStore`,
    description: `Explore ${cat.name} at EntizNetStore — premium adult-lifestyle & luxury goods.`,
    robots: { index: true, follow: true },
  };
}

// Keep this dynamic while you wire real data later
export const revalidate = 0;

/* -------------------------------------------
   Local UI helpers (consistent with Store)
-------------------------------------------- */
const grad =
  "bg-[linear-gradient(135deg,var(--brand-primary),var(--brand-secondary))]";
const cardBase =
  "overflow-hidden rounded-[14px] border border-white/10 bg-white/[0.04] backdrop-blur transition hover:bg-white/[0.08]";
const titleH2 = "mb-3 text-[22px] md:text-[26px] font-black tracking-tight";
const titleH3 = "mb-4 text-[18px] md:text-[20px] font-extrabold";

/* -------------------------------------------
   Category image map (fallback-safe)
-------------------------------------------- */
const CATEGORY_IMG_MAP: Record<string, string> = {
  "sex-toys": "/images/categories/sex-toys.jpg",
  "supplements-and-enhancers": "/images/categories/supplements.jpg",
  condoms: "/images/categories/condoms.jpg",
  essentials: "/images/categories/essentials.jpg",
  "massage-oils-and-creams": "/images/categories/massage-oils.jpg",
  "lubricants-and-perfumes": "/images/categories/lubricants.jpg",
  "lingerie-and-costumes": "/images/categories/lingerie.jpg",
  "candles-and-atmosphere": "/images/categories/candles.jpg",
  "couple-essentials": "/images/categories/couples.jpg",
  "fetish-and-bdsm-gear": "/images/categories/bdsm.jpg",
  "health-and-hygiene": "/images/categories/hygiene.jpg",
  "app-and-smart-toys": "/images/categories/smart-toys.jpg",
  "lgbtq-collection": "/images/categories/lgbtq.jpg",
  "luxury-and-collectibles": "/images/categories/luxury.jpg",
  "education-and-accessories": "/images/categories/education.jpg",
  "native-and-herbal-blends": "/images/categories/herbal.jpg",
  "discreet-kits": "/images/categories/discreet-kits.jpg",
};
function categoryImage(slug: string) {
  return CATEGORY_IMG_MAP[slug] || "/images/menu/default-category.jpg";
}

/* -------------------------------------------
   Demo products (replace with server data later)
-------------------------------------------- */
type Item = {
  id: string;
  title: string;
  img: string;
  price: number;
  subcat?: string;
};

function demo(
  categorySlug: string,
  categoryName: string,
  subcat?: string,
  n = 15,
): Item[] {
  return Array.from({ length: n }).map((_, i) => {
    const price = 19 + (i % 7) + (i % 3) * 0.99;
    return {
      id: `${categorySlug}-${subcat ? subcat.toLowerCase().replace(/\s+/g, "-") + "-" : ""}${i}`,
      title: `${categoryName} • ${subcat ?? "Assorted"} #${i + 1}`,
      img: `/demo/products/p${(i % 6) + 1}.jpg`,
      price,
      subcat,
    };
  });
}

/* -------------------------------------------
   UI sections
-------------------------------------------- */
function Banner({ cat }: { cat: Cat }) {
  const img = categoryImage(cat.slug);
  return (
    <div className="relative h-[160px] w-full overflow-hidden rounded-xl md:h-[220px]">
      <Image src={img} alt={cat.name} fill className="object-cover" priority />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
      <div className="absolute left-4 top-4 md:left-6 md:top-6">
        <h2 className={titleH2}>
          <span className="mr-2 text-xl">{cat.icon ?? "🛍️"}</span>
          {cat.name}
        </h2>
        <p className="max-w-[60ch] text-sm opacity-85">
          Discover curated items under <strong>{cat.name}</strong>.
        </p>
      </div>
    </div>
  );
}

function SubcategoryChips({
  cat,
  current,
}: {
  cat: Cat;
  current?: string | null;
}) {
  const chips = (cat.sub ?? []).map((s) => s.name);
  if (!chips.length) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2" aria-label="Subcategory filters">
      <FilterChip href={`/categories/${cat.slug}`} active={!current}>
        All
      </FilterChip>
      {chips.map((name) => {
        const encoded = encodeURIComponent(name);
        return (
          <FilterChip
            key={name}
            href={`/categories/${cat.slug}?sub=${encoded}`}
            active={current === name}
          >
            {name}
          </FilterChip>
        );
      })}
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        "rounded-full border px-3 py-1 text-xs transition focus:outline-none focus:ring-2 focus:ring-white/30",
        active
          ? "border-white/20 bg-white/20"
          : "border-white/10 bg-white/10 hover:bg-white/15",
      ].join(" ")}
      aria-current={active ? "true" : undefined}
    >
      {children}
    </Link>
  );
}

function SortBar() {
  return (
    <div className="flex items-center justify-between">
      <h3 className={titleH3}>Products</h3>
      <div className="flex items-center gap-2 text-xs">
        <span className="opacity-75">Sort by:</span>
        <select
          className="rounded-md border border-white/10 bg-transparent px-2 py-1 outline-none"
          defaultValue="featured"
          aria-label="Sort products"
        >
          <option value="featured">Featured</option>
          <option value="best">Best Sellers</option>
          <option value="price_low">Price: Low → High</option>
          <option value="price_high">Price: High → Low</option>
          <option value="new">New Arrivals</option>
        </select>
      </div>
    </div>
  );
}

function ProductGrid({ items }: { items: Item[] }) {
  return (
    <div
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
      role="list"
    >
      {items.map((p) => (
        <Link
          key={p.id}
          href={`/p/${p.id}`}
          className={cardBase}
          role="listitem"
        >
          <div className="relative aspect-[4/3]">
            <Image
              src={p.img}
              alt={p.title}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 18vw"
              className="object-cover"
            />
          </div>
          <div className="p-3">
            <div className="line-clamp-2 text-[13.5px] font-bold text-foreground">
              {p.title}
            </div>
            <div className={`${grad} bg-clip-text font-extrabold text-transparent`}>
              <Price amount={p.price} />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

/* -------------------------------------------
   Page (Server Component)
-------------------------------------------- */
export default function CategoryPage({ params, searchParams }: PageProps) {
  const cat = findCategoryBySlug(params.slug);
  if (!cat) return notFound();

  const all = getAllCategories();

  const currentSub = searchParams?.sub
    ? decodeURIComponent(searchParams.sub)
    : null;

  const validSub =
    currentSub &&
    (cat.sub ?? []).some(
      (s) => s.name.toLowerCase() === currentSub.toLowerCase(),
    )
      ? currentSub
      : null;

  // Demo items; later replace with DB query using params.slug + validSub
  const items = demo(cat.slug, cat.name, validSub ?? undefined, 15);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Header />

      <section className="mx-auto max-w-screen-xl px-4 py-6">
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
          <span className="text-foreground">{cat.name}</span>
        </nav>

        {/* Banner + Subfilters */}
        <Banner cat={cat} />
        <SubcategoryChips cat={cat} current={validSub} />

        {/* Results header */}
        <div className="mt-6">
          <SortBar />
          <div className="mt-2 text-xs opacity-75">
            Showing <strong>{items.length}</strong>{" "}
            {validSub ? `“${validSub}”` : "items"} in{" "}
            <strong>{cat.name}</strong>.
          </div>
        </div>

        {/* Grid */}
        <section className="mt-4">
          <ProductGrid items={items} />
        </section>

        {/* Explore more categories */}
        <section className="mt-10">
          <h3 className={titleH3}>Explore More</h3>
          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6"
            role="list"
          >
            {all
              .filter((c) => c.slug !== cat.slug)
              .slice(0, 6)
              .map((c) => (
                <Link
                  key={c.slug}
                  href={`/categories/${c.slug}`}
                  className={`${cardBase} relative`}
                  role="listitem"
                  aria-label={`${c.name}`}
                >
                  <div className="relative aspect-[16/10]">
                    <Image
                      src={categoryImage(c.slug)}
                      alt={c.name}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-black/60" />
                  </div>
                  <div className="p-3">
                    <div className="line-clamp-1 text-[13.5px] font-bold">
                      {c.name}
                    </div>
                    <div className="line-clamp-2 text-[12.5px] opacity-80">
                      Explore curated picks
                    </div>
                  </div>
                </Link>
              ))}
          </div>
        </section>
      </section>
    </main>
  );
}
