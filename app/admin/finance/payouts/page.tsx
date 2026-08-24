import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PayoutPrepareAction, PayoutCancelAction } from "@/components/admin/PayoutOperationsActions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type PayoutRow = {
  payout_request_id: string;
  seller_id: string;
  seller_email: string | null;
  seller_storefront_name: string | null;
  payout_status: string;
  amount_cents: number | string;
  currency: string;
  provider: string | null;
  provider_payout_id: string | null;
  failure_code: string | null;
  failure_message: string | null;
  item_count: number | string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  total_count: number | string;
};

function first(value: string | string[] | undefined, fallback = "") {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}
function money(cents: number | string, currency = "usd") {
  return new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).format(Number(cents) / 100);
}
function Badge({ value }: { value: string }) {
  const good = value === "succeeded";
  const bad = ["failed", "cancelled"].includes(value);
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${good ? "bg-emerald-100 text-emerald-800" : bad ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{value.replaceAll("_", " ")}</span>;
}

export default async function AdminPayoutsPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/auth/sign-in");
  if (user.app_metadata?.role !== "admin") redirect("/store");

  const params = await searchParams;
  const query = first(params.query).slice(0, 200);
  const statuses = ["all", "pending", "processing", "succeeded", "failed", "cancelled"];
  const status = statuses.includes(first(params.status, "all")) ? first(params.status, "all") : "all";
  const page = Math.max(Number.parseInt(first(params.page, "1"), 10) || 1, 1);
  const perPage = 50;

  const provider = (process.env.PAYOUT_PROVIDER || "unconfigured").trim().toLowerCase();
  const holdDaysRaw = process.env.PAYOUT_HOLD_DAYS;
  const holdDays = holdDaysRaw ? Number.parseInt(holdDaysRaw, 10) : Number.NaN;
  const payoutConfigured = provider !== "unconfigured" && Number.isInteger(holdDays) && holdDays >= 0 && holdDays <= 365;

  const admin = getSupabaseAdmin();
  const { data, error: loadError } = await admin.rpc("admin_search_payout_requests", {
    p_admin_id: user.id,
    p_query: query,
    p_status: status,
    p_limit: perPage,
    p_offset: (page - 1) * perPage,
  });
  const payouts = (data ?? []) as PayoutRow[];
  const total = Number(payouts[0]?.total_count ?? 0);
  const totalPages = Math.max(Math.ceil(total / perPage), 1);

  function pageHref(target: number) {
    const next = new URLSearchParams();
    if (query) next.set("query", query);
    if (status !== "all") next.set("status", status);
    if (target > 1) next.set("page", String(target));
    const qs = next.toString();
    return `/admin/finance/payouts${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><Link href="/admin/finance" className="text-sm text-sky-700 hover:underline">← Finance dashboard</Link><h1 className="mt-2 text-3xl font-bold">Seller payouts</h1><p className="mt-1 max-w-3xl text-sm opacity-70">Prepare only policy-eligible escrow for a configured payout provider. Provider success is never simulated from this console.</p></div>
        <div className="text-sm opacity-70">{total.toLocaleString()} payout request{total === 1 ? "" : "s"}</div>
      </div>

      <div className={`mb-6 rounded-xl border p-4 ${payoutConfigured ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="font-semibold">Payout execution: {payoutConfigured ? "configured" : "fail-closed"}</div>
        <p className="mt-1 text-sm opacity-75">{payoutConfigured ? `Provider ${provider}; escrow becomes eligible after ${holdDays} day${holdDays === 1 ? "" : "s"}.` : "No approved provider + hold policy is configured. Staff can inspect payout state, but new payout preparation is disabled."}</p>
        <div className="mt-4 max-w-2xl"><PayoutPrepareAction enabled={payoutConfigured} /></div>
      </div>

      <form method="get" className="mb-6 grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_220px_auto]">
        <input name="query" defaultValue={query} maxLength={200} placeholder="Payout ID, Seller, email, storefront or provider reference" className="rounded-md border px-3 py-2" />
        <select name="status" defaultValue={status} className="rounded-md border px-3 py-2">{statuses.map((value) => <option key={value} value={value}>{value === "all" ? "All payout states" : value}</option>)}</select>
        <button className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white">Search</button>
      </form>

      {loadError ? <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">Unable to load payout queue.</div> : payouts.length === 0 ? <div className="rounded-xl border p-10 text-center"><h2 className="font-semibold">No payout requests match these filters</h2></div> : (
        <div className="overflow-x-auto rounded-xl border"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-4 py-3">Payout</th><th className="px-4 py-3">Seller</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Provider</th><th className="px-4 py-3">State</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y">{payouts.map((payout) => <tr key={payout.payout_request_id} className="align-top"><td className="px-4 py-4"><div className="font-mono text-xs opacity-60">{payout.payout_request_id}</div><div className="mt-1 text-xs opacity-60">{Number(payout.item_count).toLocaleString()} escrow item{Number(payout.item_count) === 1 ? "" : "s"}</div><div className="mt-1 text-xs opacity-55">{new Date(payout.created_at).toLocaleString()}</div></td><td className="px-4 py-4"><Link href={`/admin/accounts/${payout.seller_id}`} className="font-semibold text-sky-700 hover:underline">{payout.seller_storefront_name || payout.seller_email || payout.seller_id}</Link><div className="mt-1 text-xs opacity-55">{payout.seller_email}</div></td><td className="px-4 py-4 font-semibold">{money(payout.amount_cents, payout.currency)}</td><td className="px-4 py-4 text-xs">{payout.provider || "Not attached"}{payout.provider_payout_id && <div className="mt-1 font-mono opacity-60">{payout.provider_payout_id}</div>}</td><td className="px-4 py-4"><Badge value={payout.payout_status} />{payout.failure_message && <p className="mt-2 max-w-xs text-xs text-red-700">{payout.failure_code || "Failure"}: {payout.failure_message}</p>}</td><td className="px-4 py-4">{["pending", "processing"].includes(payout.payout_status) ? <PayoutCancelAction payoutRequestId={payout.payout_request_id} /> : <span className="text-xs opacity-50">Terminal</span>}</td></tr>)}</tbody></table></div>
      )}

      {totalPages > 1 && <div className="mt-6 flex items-center justify-between text-sm"><Link href={pageHref(Math.max(1, page - 1))} className={`rounded-md border px-3 py-2 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}>Previous</Link><span>Page {page} of {totalPages}</span><Link href={pageHref(Math.min(totalPages, page + 1))} className={`rounded-md border px-3 py-2 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}>Next</Link></div>}
    </div>
  );
}
