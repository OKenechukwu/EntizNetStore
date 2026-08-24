import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import RefundReviewAction from "@/components/admin/RefundReviewAction";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type RefundRow = {
  refund_request_id: string;
  order_id: string;
  order_number: string;
  buyer_id: string;
  buyer_email: string | null;
  seller_id: string;
  seller_email: string | null;
  seller_storefront_name: string | null;
  dispute_id: string | null;
  amount_cents: number | string;
  currency: string;
  reason: string;
  refund_status: string;
  admin_notes: string | null;
  payment_provider: string | null;
  provider_refund_id: string | null;
  failure_code: string | null;
  failure_message: string | null;
  payout_claim_exists: boolean;
  escrow_status: string | null;
  escrow_amount_cents: number | string | null;
  created_at: string;
  total_count: number | string;
};

function first(value: string | string[] | undefined, fallback = "") {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}
function money(cents: number | string, currency = "usd") {
  return new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).format(Number(cents) / 100);
}
function Badge({ value }: { value: string }) {
  const good = ["succeeded", "approved"].includes(value);
  const bad = ["failed", "rejected", "cancelled"].includes(value);
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${good ? "bg-emerald-100 text-emerald-800" : bad ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{value.replaceAll("_", " ")}</span>;
}

export default async function AdminRefundsPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/auth/sign-in");
  if (user.app_metadata?.role !== "admin") redirect("/store");

  const params = await searchParams;
  const query = first(params.query).slice(0, 200);
  const statuses = ["all", "requested", "approved", "rejected", "processing", "succeeded", "failed", "cancelled"];
  const status = statuses.includes(first(params.status, "all")) ? first(params.status, "all") : "all";
  const page = Math.max(Number.parseInt(first(params.page, "1"), 10) || 1, 1);
  const perPage = 50;

  const admin = getSupabaseAdmin();
  const { data, error: loadError } = await admin.rpc("admin_search_refund_requests", {
    p_admin_id: user.id,
    p_query: query,
    p_status: status,
    p_limit: perPage,
    p_offset: (page - 1) * perPage,
  });
  const refunds = (data ?? []) as RefundRow[];
  const total = Number(refunds[0]?.total_count ?? 0);
  const totalPages = Math.max(Math.ceil(total / perPage), 1);

  function pageHref(target: number) {
    const next = new URLSearchParams();
    if (query) next.set("query", query);
    if (status !== "all") next.set("status", status);
    if (target > 1) next.set("page", String(target));
    const qs = next.toString();
    return `/admin/refunds${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm text-sky-700 hover:underline">← Admin dashboard</Link>
          <h1 className="mt-2 text-3xl font-bold">Refund operations</h1>
          <p className="mt-1 max-w-3xl text-sm opacity-70">Review marketplace refund intent separately from payment-provider execution. Approved requests are not marked successful until a trusted provider event confirms the money movement.</p>
        </div>
        <div className="text-sm opacity-70">{total.toLocaleString()} request{total === 1 ? "" : "s"}</div>
      </div>

      <form method="get" className="mb-6 grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_220px_auto]">
        <input name="query" defaultValue={query} maxLength={200} placeholder="Order, refund, user, storefront or provider reference" className="rounded-md border px-3 py-2" />
        <select name="status" defaultValue={status} className="rounded-md border px-3 py-2">
          {statuses.map((value) => <option key={value} value={value}>{value === "all" ? "All refund states" : value.replaceAll("_", " ")}</option>)}
        </select>
        <button className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white">Search</button>
      </form>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">Unable to load refund queue. No marketplace state was changed.</div>
      ) : refunds.length === 0 ? (
        <div className="rounded-xl border p-10 text-center"><h2 className="font-semibold">No refund requests match these filters</h2></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-4 py-3">Refund / order</th><th className="px-4 py-3">Parties</th><th className="px-4 py-3">Amount / reason</th><th className="px-4 py-3">Money state</th><th className="px-4 py-3">Action</th></tr></thead>
            <tbody className="divide-y">
              {refunds.map((refund) => (
                <tr key={refund.refund_request_id} className="align-top">
                  <td className="px-4 py-4"><div className="font-mono text-xs opacity-60">{refund.refund_request_id}</div><Link href={`/admin/orders/${refund.order_id}`} className="mt-1 block font-semibold text-sky-700 hover:underline">{refund.order_number}</Link>{refund.dispute_id && <Link href={`/admin/disputes?query=${refund.dispute_id}`} className="mt-1 block text-xs text-amber-700 hover:underline">Linked dispute</Link>}<div className="mt-2"><Badge value={refund.refund_status} /></div></td>
                  <td className="px-4 py-4"><div><span className="text-xs opacity-55">Buyer</span><br /><Link href={`/admin/accounts/${refund.buyer_id}`} className="hover:underline">{refund.buyer_email || refund.buyer_id}</Link></div><div className="mt-2"><span className="text-xs opacity-55">Seller</span><br /><Link href={`/admin/accounts/${refund.seller_id}`} className="hover:underline">{refund.seller_storefront_name || refund.seller_email || refund.seller_id}</Link></div></td>
                  <td className="max-w-sm px-4 py-4"><div className="font-semibold">{money(refund.amount_cents, refund.currency)}</div><p className="mt-2 text-xs opacity-70">{refund.reason}</p></td>
                  <td className="px-4 py-4"><div className="text-xs">Escrow: <strong>{refund.escrow_status || "—"}</strong>{refund.escrow_amount_cents !== null ? ` · ${money(refund.escrow_amount_cents, refund.currency)}` : ""}</div>{refund.payout_claim_exists && <p className="mt-2 max-w-xs text-xs font-semibold text-red-700">Seller payout already claims this escrow. Provider refund execution is fail-closed pending a clawback/recovery workflow.</p>}{refund.payment_provider && <p className="mt-2 text-xs opacity-70">{refund.payment_provider} · {refund.provider_refund_id || "reference pending"}</p>}{refund.failure_message && <p className="mt-2 text-xs text-red-700">{refund.failure_code || "Provider failure"}: {refund.failure_message}</p>}{refund.refund_status === "approved" && !refund.payout_claim_exists && <p className="mt-2 max-w-xs text-xs font-medium text-amber-700">Marketplace approved. Waiting for configured payment provider execution; not yet refunded.</p>}</td>
                  <td className="px-4 py-4">{refund.refund_status === "requested" ? <RefundReviewAction refundRequestId={refund.refund_request_id} /> : <div className="text-xs opacity-60">Reviewed / provider lifecycle in progress</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && <div className="mt-6 flex items-center justify-between text-sm"><Link href={pageHref(Math.max(1, page - 1))} className={`rounded-md border px-3 py-2 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}>Previous</Link><span>Page {page} of {totalPages}</span><Link href={pageHref(Math.min(totalPages, page + 1))} className={`rounded-md border px-3 py-2 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}>Next</Link></div>}
    </div>
  );
}
