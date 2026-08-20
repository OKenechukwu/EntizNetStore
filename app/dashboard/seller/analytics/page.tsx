import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default async function SellerAnalyticsPage() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/sign-in");

  const { data: seller } = await supabase
    .from("profiles_seller")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!seller) redirect("/dashboard");

  const [productsResult, ordersResult] = await Promise.all([
    supabase
      .from("products")
      .select("id, status, product_variants(inventory_quantity, track_inventory)")
      .eq("seller_id", user.id),
    supabase
      .from("orders")
      .select("id, status, payment_status, total_cents, created_at")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const error = productsResult.error || ordersResult.error;
  const products = productsResult.data ?? [];
  const orders = ordersResult.data ?? [];
  const paidOrders = orders.filter((order) => order.payment_status === "paid");
  const grossSalesCents = paidOrders.reduce(
    (sum, order) => sum + Number(order.total_cents),
    0,
  );
  const availableUnits = products.reduce(
    (total, product) =>
      total +
      (product.product_variants ?? []).reduce(
        (sum, variant) =>
          sum +
          (variant.track_inventory
            ? Math.max(0, Number(variant.inventory_quantity ?? 0))
            : 0),
        0,
      ),
    0,
  );

  const cards = [
    { label: "Active products", value: products.filter((p) => p.status === "active").length },
    { label: "Paid orders", value: paidOrders.length },
    { label: "Gross sales", value: money(grossSalesCents) },
    { label: "Tracked units available", value: availableUnits },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Store Analytics</h1>
          <p className="mt-1 text-sm text-gray-600">
            Live totals from your products and customer orders.
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <Link href="/dashboard/orders" className="underline">
            View orders
          </Link>
          <Link href="/dashboard/seller" className="underline">
            Back to dashboard
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
          Unable to load analytics: {error.message}
        </div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <article key={card.label} className="rounded-xl border bg-white p-5">
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="mt-2 text-3xl font-bold">{card.value}</p>
              </article>
            ))}
          </section>

          <section className="mt-8 rounded-xl border bg-white p-5">
            <h2 className="text-lg font-semibold">Recent orders</h2>
            {!orders.length ? (
              <p className="mt-4 text-sm text-gray-600">No orders yet.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-gray-500">
                    <tr>
                      <th className="pb-2 pr-4 font-medium">Date</th>
                      <th className="pb-2 pr-4 font-medium">Status</th>
                      <th className="pb-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {orders.slice(0, 10).map((order) => (
                      <tr key={order.id}>
                        <td className="py-3 pr-4">
                          {order.created_at
                            ? new Date(order.created_at).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="py-3 pr-4 capitalize">
                          {order.payment_status} · {order.status}
                        </td>
                        <td className="py-3 text-right font-medium">
                          {money(Number(order.total_cents))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
