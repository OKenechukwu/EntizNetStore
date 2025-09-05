// app/store/page.tsx
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type Product = {
  id: string;
  title: string | null;
  description: string | null;
  price: number | null;
  images: string[] | null;
};

function formatPrice(n?: number | null) {
  if (n == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

export default async function StorePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data, error } = await supabase
    .from("products")
    .select("id, title, description, price, images")
    .order("title", { ascending: true });

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-2">Store</h1>
        <p className="text-sm text-red-600">
          Failed to load products: {error.message}
        </p>
      </div>
    );
  }

  const products = (data || []) as Product[];

  if (products.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Store</h1>
        <p className="text-sm text-gray-500">No products yet.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Store</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((p) => {
          const img =
            Array.isArray(p.images) && p.images[0]
              ? p.images[0]
              : "/placeholder.png";
          return (
            <Link
              key={p.id}
              href={`/store/${p.id}`} // <- **THIS forces link by row id**
              className="block rounded-xl border hover:shadow-md transition"
            >
              <div className="w-full aspect-video overflow-hidden rounded-t-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img}
                  alt={p.title ?? "Product"}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4">
                <h2 className="font-semibold">
                  {p.title ?? "Untitled product"}
                </h2>
                <p className="text-sm text-gray-500 line-clamp-1">
                  {p.description ?? "No description."}
                </p>
                <div className="mt-2 font-medium">{formatPrice(p.price)}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
