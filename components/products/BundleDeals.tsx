// ---------- components/product/BundleDeals.tsx ----------
"use client";

export default function BundleDeals({
  items,
}: {
  items: { id: string; title: string; priceEUR: number; image: string }[];
}) {
  if (!items || items.length === 0) return null;
  return (
    <section className="mt-8 rounded-xl border p-4">
      <h3 className="mb-4 text-lg font-semibold">Bundle & Save</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {items.map((it) => (
          <a
            key={it.id}
            href={`/products/${it.id}`}
            className="rounded-lg border p-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={it.image}
              alt={it.title}
              className="aspect-square w-full rounded-md object-cover"
            />
            <div className="mt-2 text-sm font-medium">{it.title}</div>
            <div className="text-sm opacity-80">€{it.priceEUR.toFixed(2)}</div>
          </a>
        ))}
      </div>
    </section>
  );
}
