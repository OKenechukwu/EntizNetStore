import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Summary = {
  grossSalesCents?: number | string;
  customerRefundedCents?: number | string;
  netGmvCents?: number | string;
  grossPlatformRevenueCents?: number | string;
  platformRevenueRefundedCents?: number | string;
  netPlatformRevenueCents?: number | string;
  escrowHeldCents?: number | string;
  escrowReleasedCents?: number | string;
  payoutPendingCents?: number | string;
  payoutProcessingCents?: number | string;
  payoutSucceededCents?: number | string;
  openDisputes?: number | string;
  pendingRefunds?: number | string;
  paymentSessionsRequiringPayment?: number | string;
  paidOrders?: number | string;
  generatedAt?: string;
};
type TransactionRow = {
  transaction_type: string;
  transaction_id: string;
  order_id: string | null;
  order_number: string | null;
  account_id: string | null;
  account_email: string | null;
  counterparty_id: string | null;
  counterparty_email: string | null;
  transaction_status: string;
  amount_cents: number | string;
  currency: string;
  provider: string | null;
  provider_reference: string | null;
  created_at: string;
  total_count: number | string;
};

function first(value: string | string[] | undefined, fallback = "") {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}
function money(cents: number | string | undefined, currency = "usd") {
  return new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).format(Number(cents ?? 0) / 100);
}
function Badge({ value }: { value: string }) {
  const good = ["paid", "succeeded", "released"].includes(value);
  const bad = ["failed", "cancelled", "refunded"].includes(value);
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${good ? "bg-emerald-100 text-emerald-800" : bad ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{value.replaceAll("_", " ")}</span>;
}

export default async function AdminFinancePage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/auth/sign-in");
  if (user.app_metadata?.role !== "admin") redirect("/store");

  const params = await searchParams;
  const query = first(params.query).slice(0, 200);
  const types = ["all", "payment", "refund", "payout", "escrow"];
  const type = types.includes(first(params.type, "all")) ? first(params.type, "all") : "all";
  const status = first(params.status, "all").slice(0, 50) || "all";
  const page = Math.max(Number.parseInt(first(params.page, "1"), 10) || 1, 1);
  const perPage = 50;

  const admin = getSupabaseAdmin();
  const [{ data: summaryData, error: summaryError }, { data: transactionData, error: transactionError }] = await Promise.all([
    admin.rpc("admin_get_financial_operations_summary", { p_admin_id: user.id }),
    admin.rpc("admin_search_financial_transactions", {
      p_admin_id: user.id,
      p_query: query,
      p_type: type,
      p_status: status,
      p_limit: perPage,
      p_offset: (page - 1) * perPage,
    }),
  ]);

  const summary = (summaryData ?? {}) as Summary;
  const transactions = (transactionData ?? []) as TransactionRow[];
  const total = Number(transactions[0]?.total_count ?? 0);
  const totalPages = Math.max(Math.ceil(total / perPage), 1);

  function pageHref(target: number) {
    const next = new URLSearchParams();
    if (query) next.set("query", query);
    if (type !== "all") next.set("type", type);
    if (status !== "all") next.set("status", status);
    if (target > 1) next.set("page", String(target));
    const qs = next.toString();
    return `/admin/finance${qs ? `?${qs}` : ""}`;
  }

  const cards = [
    ["Gross sales", money(summary.grossSalesCents)],
    ["Customer refunds", money(summary.customerRefundedCents)],
    ["Net GMV", money(summary.netGmvCents)],
    ["Gross platform revenue", money(summary.grossPlatformRevenueCents)],
    ["Revenue reversed by refunds", money(summary.platformRevenueRefundedCents)],
    ["Net platform revenue", money(summary.netPlatformRevenueCents)],
    ["Escrow held", money(summary.escrowHeldCents)],
    ["Payouts processing", money(Number(summary.payoutPendingCents ?? 0) + Number(summary.payoutProcessingCents ?? 0))],
  ] as const;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm text-sky-700 hover:underline">← Admin dashboard</Link>
          <h1 className="mt-2 text-3xl font-bold">Finance & transactions</h1>
          <p className="mt-1 max-w-3xl text-sm opacity-70">Operational view over canonical payment, refund, escrow and payout records. Figures are derived from marketplace ledgers; this page does not create a second accounting source.</p>
        </div>
        <div className="flex gap-2 text-sm"><Link href="/admin/finance/escrow" className="rounded-md border px-3 py-2 hover:bg-slate-50">Escrow</Link><Link href="/admin/finance/payouts" className="rounded-md border px-3 py-2 hover:bg-slate-50">Payouts</Link><Link href="/admin/audit" className="rounded-md border px-3 py-2 hover:bg-slate-50">Audit log</Link></div>
      </div>

      {summaryError ? <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">Unable to load finance summary.</div> : (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(([label, value]) => <div key={label} className="rounded-xl border p-4"><div className="text-xs uppercase tracking-wide opacity-55">{label}</div><div className="mt-2 text-2xl font-bold">{value}</div></div>)}
        </div>
      )}

      <div className="mb-6 grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div><div className="text-xs uppercase opacity-55">Open disputes</div><div className="mt-1 text-xl font-semibold">{Number(summary.openDisputes ?? 0).toLocaleString()}</div></div>
        <div><div className="text-xs uppercase opacity-55">Pending refunds</div><div className="mt-1 text-xl font-semibold">{Number(summary.pendingRefunds ?? 0).toLocaleString()}</div></div>
        <div><div className="text-xs uppercase opacity-55">Payment sessions requiring payment</div><div className="mt-1 text-xl font-semibold">{Number(summary.paymentSessionsRequiringPayment ?? 0).toLocaleString()}</div></div>
        <div><div className="text-xs uppercase opacity-55">Paid orders</div><div className="mt-1 text-xl font-semibold">{Number(summary.paidOrders ?? 0).toLocaleString()}</div></div>
      </div>

      <h2 className="mb-3 text-xl font-semibold">Global transaction search</h2>
      <form method="get" className="mb-6 grid gap-3 rounded-xl border p-4 lg:grid-cols-[1fr_180px_180px_auto]">
        <input name="query" defaultValue={query} maxLength={200} placeholder="ID, order, email, provider reference" className="rounded-md border px-3 py-2" />
        <select name="type" defaultValue={type} className="rounded-md border px-3 py-2">{types.map((value) => <option key={value} value={value}>{value === "all" ? "All transaction types" : value}</option>)}</select>
        <input name="status" defaultValue={status === "all" ? "" : status} maxLength={50} placeholder="Status (optional)" className="rounded-md border px-3 py-2" />
        <button className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white">Search</button>
      </form>

      {transactionError ? <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">Unable to load transaction search. No marketplace state was changed.</div> : transactions.length === 0 ? <div className="rounded-xl border p-10 text-center"><h3 className="font-semibold">No transactions match these filters</h3></div> : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-4 py-3">Type / ID</th><th className="px-4 py-3">Order</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Created</th></tr></thead>
            <tbody className="divide-y">{transactions.map((row) => <tr key={`${row.transaction_type}:${row.transaction_id}`} className="align-top"><td className="px-4 py-4"><div className="font-semibold capitalize">{row.transaction_type}</div><div className="mt-1 font-mono text-xs opacity-55">{row.transaction_id}</div></td><td className="px-4 py-4">{row.order_id ? <Link href={`/admin/orders/${row.order_id}`} className="text-sky-700 hover:underline">{row.order_number || row.order_id}</Link> : "—"}</td><td className="px-4 py-4">{row.account_id ? <Link href={`/admin/accounts/${row.account_id}`} className="hover:underline">{row.account_email || row.account_id}</Link> : "—"}{row.counterparty_id && <div className="mt-1 text-xs opacity-60">↔ {row.counterparty_email || row.counterparty_id}</div>}</td><td className="px-4 py-4 font-semibold">{money(row.amount_cents, row.currency)}</td><td className="px-4 py-4"><Badge value={row.transaction_status} /></td><td className="px-4 py-4 text-xs">{row.provider || "—"}{row.provider_reference && <div className="mt-1 font-mono opacity-60">{row.provider_reference}</div>}</td><td className="px-4 py-4 text-xs">{new Date(row.created_at).toLocaleString()}</td></tr>)}</tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && <div className="mt-6 flex items-center justify-between text-sm"><Link href={pageHref(Math.max(1, page - 1))} className={`rounded-md border px-3 py-2 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}>Previous</Link><span>Page {page} of {totalPages} · {total.toLocaleString()} rows</span><Link href={pageHref(Math.min(totalPages, page + 1))} className={`rounded-md border px-3 py-2 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}>Next</Link></div>}
    </div>
  );
}
