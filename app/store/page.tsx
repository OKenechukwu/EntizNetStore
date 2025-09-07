// app/store/page.tsx
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import CurrencyPicker from "@/components/CurrencyPicker";
import { formatPrice } from "@/lib/format";
import {
  getFxRates,
  convertFromBase,
  BASE_CURRENCY,
  DEFAULT_CURRENCY,
} from "@/lib/currency";

type Product = {
  id: string;
  title: string | null;
  description: string | null;
  price: number | null; // stored in BASE_CURRENCY
  images: string[] | null;
};

export default async function StorePage() {
  // 1) Supabase fetch
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data, error } = await supabase
    .from("products")
    .select("id, title, description, price, images")
    .order("title", { ascending: true });

  // 2) Currency: read user preference from cookie + fetch FX rates (base -> target)
  const userCurrency =
    cookies().get("currency")?.value?.toUpperCase() || DEFAULT_CURRENCY;
  const rates = await getFxRates(BASE_CURRENCY);

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Store</h1>
          <CurrencyPicker />
        </div>
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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Store</h1>
          <CurrencyPicker />
        </div>
        <p className="text-sm text-gray-500">No products yet.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Store</h1>
        <CurrencyPicker />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((p) => {
          const img =
            Array.isArray(p.images) && p.images[0]
              ? p.images[0]
              : "/placeholder.png";

          // Convert from BASE_CURRENCY (stored) to user's currency for display
          const displayAmount = convertFromBase(
            Number(p.price ?? 0),
            userCurrency,
            rates,
          );

          return (
            <Link
              key={p.id}
              href={`/store/${p.id}`}
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

                {/* Price in user's selected currency */}
                <p className="mt-2 text-sm font-semibold">
                  {formatPrice(displayAmount, userCurrency)}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
