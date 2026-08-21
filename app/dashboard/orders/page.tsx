import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import SellerOrderActions from "@/components/seller/SellerOrderActions";

export default async function SellerOrdersPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const { data: seller } = await supabase.from("profiles_seller").select("id").eq("id", user.id).maybeSingle();
  if (!seller) redirect("/dashboard");

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, order_number, status, payment_status, fulfillment_status, total_cents, created_at, order_items(id, product_title, variant_title, quantity, total_cents)")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold">Seller Orders</h1><p className="mt-1 text-sm text-gray-600">Paid and pending orders for your store.</p></div>
        <Link href="/dashboard/seller" className="text-sm underline">Back to dashboard</Link>
      </div>
      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">Unable to load orders: {error.message}</div>
      ) : !orders?.length ? (
        <div className="rounded-xl border p-10 text-center text-gray-600">No customer orders yet.</div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <article key={order.id} className="rounded-xl border bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
                <div><h2 className="font-semibold">{order.order_number}</h2><p className="text-xs text-gray-500">{order.created_at ? new Date(order.created_at).toLocaleString() : "—"}</p></div>
                <div className="text-right"><p className="font-semibold">${(Number(order.total_cents)/100).toFixed(2)} USD</p><p className="text-xs uppercase text-gray-500">{order.payment_status} · {order.status}</p></div>
              </div>
              <ul className="divide-y">
                {(order.order_items ?? []).map((item) => (
                  <li key={item.id} className="flex justify-between gap-4 py-3 text-sm">
                    <span>{item.product_title}{item.variant_title ? ` — ${item.variant_title}` : ""} × {item.quantity}</span>
                    <span>${(Number(item.total_cents)/100).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              <p className="pt-2 text-xs text-gray-500">Fulfillment: {order.fulfillment_status}</p>
              <SellerOrderActions
                orderId={order.id}
                status={order.status}
                paymentStatus={order.payment_status}
              />
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
