// ---------- components/home/FeaturedProducts.tsx ----------
"use client";

export default function FeaturedProducts({
  items,
}: {
  items: { id: string; title: string; priceEUR: number; image: string }[];
}) {
  if (!items || items.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <h2 className="mb-3 text-2xl font-bold">Featured Products</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {items.map((r) => (
          <a
            key={r.id}
            href={`/products/${r.id}`}
            className="group rounded-lg border p-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={r.image}
              alt={r.title}
              className="aspect-square w-full rounded-md object-cover"
            />
            <div className="mt-2 text-sm font-semibold group-hover:underline">
              {r.title}
            </div>
            <div className="text-sm opacity-80">€{r.priceEUR.toFixed(2)}</div>
          </a>
        ))}
      </div>
    </section>
  );
}
