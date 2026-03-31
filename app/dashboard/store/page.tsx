// app/dashboard/store/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import CurrencyPicker from "@/components/CurrencyPicker";
import { formatPrice } from "@/lib/format";
import {
  getFxRates,
  convertFromBase,
  BASE_CURRENCY,
  DEFAULT_CURRENCY,
} from "@/lib/currency";
import { createServerSupabase } from "@/lib/supabase/server";

type Product = {
  id: string;
  title: string | null;
  price: number | null; // stored in BASE_CURRENCY
  images: string[] | null;
};

export default async function DashboardStorePage() {
  // Auth (server-side)
  const supabase = createServerSupabase();
  const {
    data: { session },
    error: sessErr,
  } = await supabase.auth.getSession();
  if (!session || sessErr) {
    redirect("/auth/sign-in");
  }

  // Fetch only this user's products
  const { data, error } = await supabase
    .from("products")
    .select("id,title,price,images")
    .eq("owner", session.user.id)
    .order("title", { ascending: true });

  const products = (data ?? []) as Product[];

  // Currency preference + FX rates
  const userCurrency =
    cookies().get("currency")?.value?.toUpperCase() || DEFAULT_CURRENCY;
  const rates = await getFxRates();

  // Error state
  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">My Products</h1>
          <div className="flex items-center gap-4">
            <CurrencyPicker />
            <Link
              href="/dashboard/store/new"
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              New Product
            </Link>
            <Link href="/auth/sign-out" className="text-sm underline">
              Sign out
            </Link>
          </div>
        </div>
        <p className="text-sm text-red-600">Failed to load: {error.message}</p>
      </div>
    );
  }

  // Empty state
  if (products.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">My Products</h1>
          <div className="flex items-center gap-4">
            <CurrencyPicker />
            <Link
              href="/dashboard/store/new"
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              New Product
            </Link>
            <Link href="/auth/sign-out" className="text-sm underline">
              Sign out
            </Link>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-4">You have no products yet.</p>
      </div>
    );
  }

  // Table view
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Products</h1>
        <div className="flex items-center gap-4">
          <CurrencyPicker />
          <Link
            href="/dashboard/store/new"
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            New Product
          </Link>
          <Link href="/auth/sign-out" className="text-sm underline">
            Sign out
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map((p) => {
              const img =
                Array.isArray(p.images) && p.images[0]
                  ? p.images[0]
                  : "/placeholder.png";

              const displayAmount = convertFromBase(
                Number(p.price ?? 0),
                userCurrency,
                rates,
              );

              return (
                <tr key={p.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex-shrink-0 h-16 w-16">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className="h-16 w-16 rounded-lg object-cover"
                        src={img}
                        alt={p.title ?? "Product"}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {p.title ?? "Untitled product"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      {formatPrice(displayAmount, userCurrency)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <Link
                      href={`/store/${p.id}`}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      View
                    </Link>
                    <Link
                      href={`/dashboard/store/${p.id}/edit`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/internal/upload-product-image?pid=${p.id}`}
                      className="text-green-600 hover:text-green-900"
                    >
                      Upload image
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
