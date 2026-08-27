import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import DisputeTransitionAction from "@/components/admin/DisputeTransitionAction";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type DisputeStatus = "open" | "under_review" | "resolved_buyer" | "resolved_seller" | "closed";
type DisputeRow = {
  dispute_id: string;
  order_id: string;
  order_number: string;
  buyer_id: string;
  buyer_email: string | null;
  seller_id: string;
  seller_email: string | null;
  seller_storefront_name: string | null;
  raised_by: string;
  raised_by_role: string;
  reason_code: string;
  details: string | null;
  priority: string;
  dispute_status: DisputeStatus;
  assigned_admin_id: string | null;
  resolution_notes: string | null;
  escrow_status: string | null;
  escrow_amount_cents: number | string | null;
  refund_status: string | null;
  refund_amount_cents: number | string | null;
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
  const good = ["resolved_buyer", "resolved_seller", "closed"].includes(value);
  const urgent = ["urgent", "high"].includes(value);
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${urgent ? "bg-red-100 text-red-800" : good ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{value.replaceAll("_", " ")}</span>;
}

export default async function AdminDisputesPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/auth/sign-in");
  if (user.app_metadata?.role !== "admin") redirect("/store");

  const params = await searchParams;
  const query = first(params.query).slice(0, 200);
  const statuses = ["all", "open", "under_review", "resolved_buyer", "resolved_seller", "closed"];
  const priorities = ["all", "urgent", "high", "normal", "low"];
  const status = statuses.includes(first(params.status, "all")) ? first(params.status, "all") : "all";
  const priority = priorities.includes(first(params.priority, "all")) ? first(params.priority, "all") : "all";
  const page = Math.max(Number.parseInt(first(params.page, "1"), 10) || 1, 1);
  const perPage = 50;

  const admin = getSupabaseAdmin();
  const { data, error: loadError } = await admin.rpc("admin_search_order_disputes", {
    p_admin_id: user.id,
    p_query: query,
    p_status: status,
    p_priority: priority,
    p_limit: perPage,
    p_offset: (page - 1) * perPage,
  });
  const disputes = (data ?? []) as DisputeRow[];
  const total = Number(disputes[0]?.total_count ?? 0);
  const totalPages = Math.max(Math.ceil(total / perPage), 1);

  function pageHref(target: number) {
    const next = new URLSearchParams();
    if (query) next.set("query", query);
    if (status !== "all") next.set("status", status);
    if (priority !== "all") next.set("priority", priority);
    if (target > 1) next.set("page", String(target));
    const qs = next.toString();
    return `/admin/disputes${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm text-sky-700 hover:underline">← Admin dashboard</Link>
          <h1 className="mt-2 text-3xl font-bold">Dispute operations</h1>
          <p className="mt-1 max-w-3xl text-sm opacity-70">Disputes freeze held escrow before payout. Buyer-favoring cases stay money-blocking until a trusted refund completes.</p>
        </div>
        <div className="text-sm opacity-70">{total.toLocaleString()} case{total === 1 ? "" : "s"}</div>
      </div>

      <form method="get" className="mb-6 grid gap-3 rounded-xl border p-4 lg:grid-cols-[1fr_200px_180px_auto]">
        <input aria-label="Search disputes" name="query" defaultValue={query} maxLength={200} placeholder="Order, dispute, Buyer, Seller or storefront" className="rounded-md border px-3 py-2" />
        <select aria-label="Dispute status" name="status" defaultValue={status} className="rounded-md border px-3 py-2">
          {statuses.map((value) => <option key={value} value={value}>{value === "all" ? "All dispute states" : value.replaceAll("_", " ")}</option>)}
        </select>
        <select aria-label="Dispute priority" name="priority" defaultValue={priority} className="rounded-md border px-3 py-2">
          {priorities.map((value) => <option key={value} value={value}>{value === "all" ? "All priorities" : value}</option>)}
        </select>
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white">Search</button>
      </form>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">Unable to load dispute queue. No marketplace state was changed.</div>
      ) : disputes.length === 0 ? (
        <div className="rounded-xl border p-10 text-center"><h2 className="font-semibold">No disputes match these filters</h2></div>
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute) => (
            <article key={dispute.dispute_id} className="rounded-xl border p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2"><Badge value={dispute.priority} /><Badge value={dispute.dispute_status} /></div>
                  <Link href={`/admin/orders/${dispute.order_id}`} className="mt-3 block text-lg font-semibold text-sky-700 hover:underline">{dispute.order_number}</Link>
                  <div className="mt-1 font-mono text-xs opacity-55">{dispute.dispute_id}</div>
                </div>
                <div className="text-right text-xs opacity-60">Opened {new Date(dispute.created_at).toLocaleString()}<br />Raised by {dispute.raised_by_role}</div>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr_1.2fr]">
                <div className="text-sm"><div className="text-xs font-semibold uppercase tracking-wide opacity-55">Buyer</div><Link href={`/admin/accounts/${dispute.buyer_id}`} className="mt-1 block hover:underline">{dispute.buyer_email || dispute.buyer_id}</Link><div className="mt-3 text-xs font-semibold uppercase tracking-wide opacity-55">Seller</div><Link href={`/admin/accounts/${dispute.seller_id}`} className="mt-1 block hover:underline">{dispute.seller_storefront_name || dispute.seller_email || dispute.seller_id}</Link></div>
                <div className="text-sm"><div className="text-xs font-semibold uppercase tracking-wide opacity-55">Reason</div><div className="mt-1 font-medium">{dispute.reason_code.replaceAll("_", " ")}</div><p className="mt-2 text-xs opacity-70">{dispute.details || "No additional details supplied."}</p></div>
                <div className="rounded-lg bg-slate-50 p-4 text-sm"><div className="text-xs font-semibold uppercase tracking-wide opacity-55">Money hold</div><div className="mt-2">Escrow: <strong>{dispute.escrow_status || "—"}</strong>{dispute.escrow_amount_cents !== null ? ` · ${money(dispute.escrow_amount_cents)}` : ""}</div>{dispute.refund_status && <div className="mt-2">Latest refund: <strong>{dispute.refund_status}</strong>{dispute.refund_amount_cents !== null ? ` · ${money(dispute.refund_amount_cents)}` : ""}</div>}{dispute.resolution_notes && <p className="mt-3 text-xs opacity-70">Resolution: {dispute.resolution_notes}</p>}</div>
              </div>

              <div className="mt-5 border-t pt-4"><DisputeTransitionAction disputeId={dispute.dispute_id} status={dispute.dispute_status} /></div>
            </article>
          ))}
        </div>
      )}

      {totalPages > 1 && <div className="mt-6 flex items-center justify-between text-sm"><Link href={pageHref(Math.max(1, page - 1))} className={`rounded-md border px-3 py-2 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}>Previous</Link><span>Page {page} of {totalPages}</span><Link href={pageHref(Math.min(totalPages, page + 1))} className={`rounded-md border px-3 py-2 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}>Next</Link></div>}
    </div>
  );
}
