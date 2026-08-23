import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type EscrowRow = {
  escrow_transaction_id: string;
  order_id: string;
  order_number: string;
  seller_id: string;
  seller_email: string | null;
  seller_storefront_name: string | null;
  escrow_status: string;
  amount_cents: number | string;
  dispute_id: string | null;
  payout_request_id: string | null;
  payout_status: string | null;
  delivered_at: string | null;
  released_at: string | null;
  release_reason: string | null;
  created_at: string;
  total_count: number | string;
};

function first(value: string | string[] | undefined, fallback = "") {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}
function money(cents: number | string) {
  return new Intl.NumberFormat("en", { style: "currency", currency: "USD" }).format(Number(cents) / 100);
}
function Badge({ value }: { value: string }) {
  const good = value === "released";
  const bad = value === "refunded";
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${good ? "bg-emerald-100 text-emerald-800" : bad ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{value}</span>;
}

export default async function AdminEscrowPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/auth/sign-in");
  if (user.app_metadata?.role !== "admin") redirect("/store");

  const params = await searchParams;
  const query = first(params.query).slice(0, 200);
  const statuses = ["all", "held", "released", "refunded"];
  const status = statuses.includes(first(params.status, "all")) ? first(params.status, "all") : "all";
  const page = Math.max(Number.parseInt(first(params.page, "1"), 10) || 1, 1);
  const perPage = 50;

  const admin = getSupabaseAdmin();
  const { data, error: loadError } = await admin.rpc("admin_search_escrow_transactions", {
    p_admin_id: user.id,
    p_query: query,
    p_status: status,
    p_limit: perPage,
    p_offset: (page - 1) * perPage,
  });
  const rows = (data ?? []) as EscrowRow[];
  const total = Number(rows[0]?.total_count ?? 0);
  const totalPages = Math.max(Math.ceil(total / perPage), 1);

  function pageHref(target: number) {
    const next = new URLSearchParams();
    if (query) next.set("query", query);
    if (status !== "all") next.set("status", status);
    if (target > 1) next.set("page", String(target));
    const qs = next.toString();
    return `/admin/finance/escrow${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><Link href="/admin/finance" className="text-sm text-sky-700 hover:underline">← Finance dashboard</Link><h1 className="mt-2 text-3xl font-bold">Escrow operations</h1><p className="mt-1 max-w-3xl text-sm opacity-70">Inspect Seller funds held, disputed, claimed by payouts, released or refunded. Escrow mutation remains state-machine-only.</p></div><div className="text-sm opacity-70">{total.toLocaleString()} escrow transaction{total === 1 ? "" : "s"}</div></div>

      <form method="get" className="mb-6 grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_220px_auto]">
        <input name="query" defaultValue={query} maxLength={200} placeholder="Escrow, order, Seller, dispute or payout ID" className="rounded-md border px-3 py-2" />
        <select name="status" defaultValue={status} className="rounded-md border px-3 py-2">{statuses.map((value) => <option key={value} value={value}>{value === "all" ? "All escrow states" : value}</option>)}</select>
        <button className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white">Search</button>
      </form>

      {loadError ? <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">Unable to load escrow ledger.</div> : rows.length === 0 ? <div className="rounded-xl border p-10 text-center"><h2 className="font-semibold">No escrow rows match these filters</h2></div> : (
        <div className="overflow-x-auto rounded-xl border"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-4 py-3">Escrow</th><th className="px-4 py-3">Order</th><th className="px-4 py-3">Seller</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">State</th><th className="px-4 py-3">Claims / holds</th></tr></thead><tbody className="divide-y">{rows.map((row) => <tr key={row.escrow_transaction_id} className="align-top"><td className="px-4 py-4"><div className="font-mono text-xs opacity-60">{row.escrow_transaction_id}</div><div className="mt-1 text-xs opacity-55">Created {new Date(row.created_at).toLocaleString()}</div></td><td className="px-4 py-4"><Link href={`/admin/orders/${row.order_id}`} className="font-semibold text-sky-700 hover:underline">{row.order_number}</Link>{row.delivered_at && <div className="mt-1 text-xs opacity-55">Delivered {new Date(row.delivered_at).toLocaleString()}</div>}</td><td className="px-4 py-4"><Link href={`/admin/accounts/${row.seller_id}`} className="hover:underline">{row.seller_storefront_name || row.seller_email || row.seller_id}</Link></td><td className="px-4 py-4 font-semibold">{money(row.amount_cents)}</td><td className="px-4 py-4"><Badge value={row.escrow_status} />{row.released_at && <div className="mt-2 text-xs opacity-55">Released {new Date(row.released_at).toLocaleString()}</div>}{row.release_reason && <div className="mt-1 max-w-xs text-xs opacity-70">{row.release_reason}</div>}</td><td className="px-4 py-4 text-xs">{row.dispute_id ? <Link href={`/admin/disputes?query=${row.dispute_id}`} className="block font-semibold text-amber-700 hover:underline">Dispute hold · {row.dispute_id}</Link> : <div className="opacity-55">No dispute hold</div>}{row.payout_request_id ? <Link href={`/admin/finance/payouts?query=${row.payout_request_id}`} className="mt-2 block font-semibold text-sky-700 hover:underline">Payout {row.payout_status || "claimed"} · {row.payout_request_id}</Link> : <div className="mt-2 opacity-55">Not claimed by payout</div>}</td></tr>)}</tbody></table></div>
      )}

      {totalPages > 1 && <div className="mt-6 flex items-center justify-between text-sm"><Link href={pageHref(Math.max(1, page - 1))} className={`rounded-md border px-3 py-2 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}>Previous</Link><span>Page {page} of {totalPages}</span><Link href={pageHref(Math.min(totalPages, page + 1))} className={`rounded-md border px-3 py-2 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}>Next</Link></div>}
    </div>
  );
}
