// app/store/[id]/page.tsx
import { cookies } from "next/headers";
import { formatPrice } from "@/lib/format";
import { getFxRates, convertFromBase, toCurrencyCode } from "@/lib/currency";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import AddToCartButton from "../AddToCartButton";
import ProductDetailsTabs from "@/components/products/ProductDetailsTabs";

type Product = {
  id: string;
  title: string | null;
  description: string | null;
  price: number | null; // stored in BASE_CURRENCY
  images: string[] | null;
};

export default async function ProductDetailPage({
  params,
}: {
  params: { id: string };
}) {
  // Supabase fetch (server)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data, error } = await supabase
    .from("products")
    .select("id, title, description, price, images")
    .eq("id", params.id)
    .single();

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <Link href="/store" className="text-sm underline">
          ← Back to Store
        </Link>
        <h1 className="text-2xl font-semibold mt-6">Product not found</h1>
        <p className="text-sm text-gray-500 mt-2">
          {error?.message ?? "No product with that ID."}
        </p>
      </div>
    );
  }

  const product = data as Product;
  const gallery = Array.isArray(product.images)
    ? product.images.filter(Boolean)
    : [];
  const hero = gallery[0] ?? "/placeholder.png";

  // Currency preference + FX conversion
  const cookieStore = await cookies();
  const userCurrency = toCurrencyCode(cookieStore.get("currency")?.value);
  const rates = await getFxRates();
  const displayAmount = convertFromBase(
    Number(product.price ?? 0),
    userCurrency,
    rates,
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-4">
        <Link href="/store" className="text-sm underline hover:opacity-80">
          ← Back to Store
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: hero + thumbs */}
        <div>
          <div className="relative w-full aspect-square overflow-hidden rounded-xl border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hero}
              alt={product.title ?? "Product image"}
              className="w-full h-full object-cover"
            />
          </div>

          {gallery.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {gallery.slice(0, 10).map((src, i) => (
                <div
                  key={i}
                  className="relative aspect-square rounded-lg overflow-hidden border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Image ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: details */}
        <div className="space-y-4">
          <h1 className="text-3xl font-bold">
            {product.title ?? "Untitled product"}
          </h1>

          {/* Price in user's selected currency */}
          <p className="text-2xl font-semibold">
            {formatPrice(displayAmount, userCurrency)}
          </p>

          <AddToCartButton 
            product={{
              id: product.id,
              title: product.title ?? "Untitled product",
              price: product.price,
              images: product.images || undefined
            }}
          />
        </div>
      </div>

      {/* Product Details Tabs */}
      <ProductDetailsTabs product={product} />
    </div>
  );
}
