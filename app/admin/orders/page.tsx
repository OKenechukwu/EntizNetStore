import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type OrderRow = {
  order_id: string;
  order_number: string;
  buyer_id: string;
  buyer_email: string | null;
  seller_id: string;
  seller_email: string | null;
  seller_storefront_name: string | null;
  order_status: string;
  payment_status: string;
  fulfillment_status: string;
  currency: string;
  total_cents: number | string;
  payment_session_status: string | null;
  payment_provider: string | null;
  provider_payment_id: string | null;
  escrow_status: string | null;
  escrow_amount_cents: number | string;
  created_at: string;
  total_count: number | string;
};

function first(value: string | string[] | undefined, fallback = "") {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

function money(cents: number | string, currency = "usd") {
  return new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).format(Number(cents) / 100);
}

function Status({ value }: { value: string | null }) {
  if (!value) return <span className="text-xs opacity-40">—</span>;
  const positive = ["paid", "confirmed", "delivered", "fulfilled", "released", "succeeded"].includes(value);
  const negative = ["failed", "cancelled", "refunded"].includes(value);
  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${positive ? "bg-emerald-100 text-emerald-800" : negative ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{value.replaceAll("_", " ")}</span>;
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/auth/sign-in");
  if (user.app_metadata?.role !== "admin") redirect("/store");

  const params = await searchParams;
  const query = first(params.query).slice(0, 200);
  const orderStatuses = ["all", "pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"];
  const paymentStatuses = ["all", "pending", "paid", "failed", "refunded", "partially_refunded"];
  const fulfillmentStatuses = ["all", "unfulfilled", "partial", "fulfilled"];
  const orderStatus = orderStatuses.includes(first(params.orderStatus, "all")) ? first(params.orderStatus, "all") : "all";
  const paymentStatus = paymentStatuses.includes(first(params.paymentStatus, "all")) ? first(params.paymentStatus, "all") : "all";
  const fulfillmentStatus = fulfillmentStatuses.includes(first(params.fulfillmentStatus, "all")) ? first(params.fulfillmentStatus, "all") : "all";
  const page = Math.max(Number.parseInt(first(params.page, "1"), 10) || 1, 1);
  const perPage = 50;

  const admin = getSupabaseAdmin();
  const { data, error: ordersError } = await admin.rpc("admin_search_marketplace_orders", {
    p_admin_id: user.id,
    p_query: query,
    p_order_status: orderStatus,
    p_payment_status: paymentStatus,
    p_fulfillment_status: fulfillmentStatus,
    p_limit: perPage,
    p_offset: (page - 1) * perPage,
  });

  const orders = (data ?? []) as OrderRow[];
  const total = Number(orders[0]?.total_count ?? 0);
  const totalPages = Math.max(Math.ceil(total / perPage), 1);

  function pageHref(target: number) {
    const next = new URLSearchParams();
    if (query) next.set("query", query);
    if (orderStatus !== "all") next.set("orderStatus", orderStatus);
    if (paymentStatus !== "all") next.set("paymentStatus", paymentStatus);
    if (fulfillmentStatus !== "all") next.set("fulfillmentStatus", fulfillmentStatus);
    if (target > 1) next.set("page", String(target));
    const qs = next.toString();
    return `/admin/orders${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm text-sky-700 hover:underline">← Admin dashboard</Link>
          <h1 className="mt-2 text-3xl font-bold">Orders & payment operations</h1>
          <p className="mt-1 max-w-3xl text-sm opacity-70">Global order visibility from canonical commerce records. State-changing actions remain restricted to trusted transition/refund/dispute workflows.</p>
        </div>
        <div className="text-sm opacity-70">{total.toLocaleString()} order{total === 1 ? "" : "s"}</div>
      </div>

      <form method="get" className="mb-6 grid gap-3 rounded-xl border p-4 lg:grid-cols-[1fr_170px_170px_170px_auto]">
        <input aria-label="Search orders" name="query" defaultValue={query} maxLength={200} placeholder="Order, user, storefront or payment reference" className="rounded-md border px-3 py-2" />
        <select aria-label="Order status" name="orderStatus" defaultValue={orderStatus} className="rounded-md border px-3 py-2">
          {orderStatuses.map((value) => <option key={value} value={value}>{value === "all" ? "All order states" : value}</option>)}
        </select>
        <select aria-label="Payment status" name="paymentStatus" defaultValue={paymentStatus} className="rounded-md border px-3 py-2">
          {paymentStatuses.map((value) => <option key={value} value={value}>{value === "all" ? "All payment states" : value.replaceAll("_", " ")}</option>)}
        </select>
        <select aria-label="Fulfillment status" name="fulfillmentStatus" defaultValue={fulfillmentStatus} className="rounded-md border px-3 py-2">
          {fulfillmentStatuses.map((value) => <option key={value} value={value}>{value === "all" ? "All fulfillment states" : value}</option>)}
        </select>
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800">Search</button>
      </form>

      {ordersError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">Unable to load orders. No marketplace state was changed.</div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border p-10 text-center"><h2 className="font-semibold">No orders match these filters</h2><p className="mt-1 text-sm opacity-70">Try a broader search or state filter.</p></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Buyer</th><th className="px-4 py-3">Seller</th><th className="px-4 py-3">States</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Escrow</th><th className="px-4 py-3 text-right">Total</th></tr></thead>
            <tbody className="divide-y">
              {orders.map((order) => (
                <tr key={order.order_id} className="align-top">
                  <td className="px-4 py-4"><Link href={`/admin/orders/${order.order_id}`} className="font-semibold text-sky-700 hover:underline">{order.order_number}</Link><div className="mt-1 text-xs opacity-55">{new Date(order.created_at).toLocaleString()}</div></td>
                  <td className="px-4 py-4"><Link href={`/admin/accounts/${order.buyer_id}`} className="hover:underline">{order.buyer_email || order.buyer_id}</Link></td>
                  <td className="px-4 py-4"><Link href={`/admin/accounts/${order.seller_id}`} className="hover:underline">{order.seller_storefront_name || order.seller_email || order.seller_id}</Link></td>
                  <td className="px-4 py-4"><div className="flex flex-wrap gap-2"><Status value={order.order_status} /><Status value={order.fulfillment_status} /></div></td>
                  <td className="px-4 py-4"><div className="flex flex-wrap gap-2"><Status value={order.payment_status} />{order.payment_session_status && <Status value={order.payment_session_status} />}</div><div className="mt-2 text-xs opacity-55">{order.payment_provider || "Provider not attached"}{order.provider_payment_id ? ` · ${order.provider_payment_id}` : ""}</div></td>
                  <td className="px-4 py-4"><Status value={order.escrow_status} /><div className="mt-2 text-xs opacity-60">{money(order.escrow_amount_cents, order.currency)}</div></td>
                  <td className="px-4 py-4 text-right font-semibold">{money(order.total_cents, order.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && <div className="mt-6 flex items-center justify-between gap-3 text-sm"><Link href={pageHref(Math.max(1, page - 1))} className={`rounded-md border px-3 py-2 ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-slate-50"}`}>Previous</Link><span>Page {page} of {totalPages}</span><Link href={pageHref(Math.min(totalPages, page + 1))} className={`rounded-md border px-3 py-2 ${page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-slate-50"}`}>Next</Link></div>}
    </div>
  );
}
