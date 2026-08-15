// app/dashboard/store/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import CurrencyPicker from "@/components/CurrencyPicker";
import { formatPrice } from "@/lib/format";
import { getFxRates, convertFromBase, toCurrencyCode } from "@/lib/currency";
import { createServerSupabase } from "@/lib/supabase/server";

type ProductRow = {
  id: string;
  title: string | null;
  base_price: number | null; // stored in BASE_CURRENCY
  status: string | null;
  product_media: { url: string; position: number | null }[] | null;
};

export default async function DashboardStorePage() {
  // Auth (server-side)
  const supabase = createServerSupabase();
  const {
    data: { user },
    error: sessErr,
  } = await supabase.auth.getUser();
  if (!user || sessErr) {
    redirect("/auth/sign-in");
  }

  // Fetch only this seller's products (canonical schema; RLS also scopes rows)
  const { data, error } = await supabase
    .from("products")
    .select("id, title, base_price, status, product_media(url, position)")
    .eq("seller_id", user.id)
    .order("title", { ascending: true });

  const products = (data ?? []) as ProductRow[];

  // Currency preference + FX rates
  const userCurrency = toCurrencyCode(cookies().get("currency")?.value);
  const rates = await getFxRates();

  const header = (
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
  );

  // Error state
  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        {header}
        <p className="text-sm text-red-600">Failed to load: {error.message}</p>
      </div>
    );
  }

  // Empty state
  if (products.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        {header}
        <p className="text-sm text-gray-500 mb-4">You have no products yet.</p>
      </div>
    );
  }

  // Table view
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {header}

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
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map((p) => {
              const media = [...(p.product_media ?? [])].sort(
                (a, b) => (a.position ?? 0) - (b.position ?? 0),
              );
              const img = media[0]?.url || "/placeholder.png";

              const displayAmount = convertFromBase(
                Number(p.base_price ?? 0),
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-xs uppercase tracking-wide text-gray-500">
                      {p.status ?? "—"}
                    </span>
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
