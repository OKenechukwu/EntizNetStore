import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type AuditRow = {
  audit_id: string;
  actor_admin_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
  total_count: number | string;
};

function first(value: string | string[] | undefined, fallback = "") {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

export default async function AdminAuditPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/auth/sign-in");
  if (user.app_metadata?.role !== "admin") redirect("/store");

  const params = await searchParams;
  const query = first(params.query).slice(0, 200);
  const action = first(params.action, "all").slice(0, 100) || "all";
  const page = Math.max(Number.parseInt(first(params.page, "1"), 10) || 1, 1);
  const perPage = 50;

  const admin = getSupabaseAdmin();
  const { data, error: loadError } = await admin.rpc("admin_search_audit_logs", {
    p_admin_id: user.id,
    p_query: query,
    p_action: action,
    p_limit: perPage,
    p_offset: (page - 1) * perPage,
  });
  const rows = (data ?? []) as AuditRow[];
  const total = Number(rows[0]?.total_count ?? 0);
  const totalPages = Math.max(Math.ceil(total / perPage), 1);

  function pageHref(target: number) {
    const next = new URLSearchParams();
    if (query) next.set("query", query);
    if (action !== "all") next.set("action", action);
    if (target > 1) next.set("page", String(target));
    const qs = next.toString();
    return `/admin/audit${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><Link href="/admin" className="text-sm text-sky-700 hover:underline">← Admin dashboard</Link><h1 className="mt-2 text-3xl font-bold">Operational audit log</h1><p className="mt-1 max-w-3xl text-sm opacity-70">Search immutable Admin actions across account suspensions, KYC, moderation, disputes, refunds, payouts and other trusted operations.</p></div><div className="text-sm opacity-70">{total.toLocaleString()} audit event{total === 1 ? "" : "s"}</div></div>

      <form method="get" className="mb-6 grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_240px_auto]">
        <input name="query" defaultValue={query} maxLength={200} placeholder="Admin, action, target type or target ID" className="rounded-md border px-3 py-2" />
        <input name="action" defaultValue={action === "all" ? "" : action} maxLength={100} placeholder="Exact action (optional)" className="rounded-md border px-3 py-2" />
        <button className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white">Search</button>
      </form>

      {loadError ? <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">Unable to load audit history.</div> : rows.length === 0 ? <div className="rounded-xl border p-10 text-center"><h2 className="font-semibold">No audit events match these filters</h2></div> : (
        <div className="overflow-x-auto rounded-xl border"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Admin</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Target</th><th className="px-4 py-3">Metadata</th></tr></thead><tbody className="divide-y">{rows.map((row) => <tr key={row.audit_id} className="align-top"><td className="whitespace-nowrap px-4 py-4 text-xs">{new Date(row.occurred_at).toLocaleString()}<div className="mt-1 font-mono opacity-45">{row.audit_id}</div></td><td className="px-4 py-4">{row.actor_admin_id ? <div><div className="font-medium">{row.actor_email || row.actor_admin_id}</div><div className="mt-1 font-mono text-xs opacity-50">{row.actor_admin_id}</div></div> : "System"}</td><td className="px-4 py-4 font-semibold">{row.action.replaceAll("_", " ")}</td><td className="px-4 py-4"><div className="text-xs uppercase opacity-55">{row.target_type || "—"}</div><div className="mt-1 font-mono text-xs">{row.target_id || "—"}</div></td><td className="max-w-xl px-4 py-4"><pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-2 text-xs">{JSON.stringify(row.metadata ?? {}, null, 2)}</pre></td></tr>)}</tbody></table></div>
      )}

      {totalPages > 1 && <div className="mt-6 flex items-center justify-between text-sm"><Link href={pageHref(Math.max(1, page - 1))} className={`rounded-md border px-3 py-2 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}>Previous</Link><span>Page {page} of {totalPages}</span><Link href={pageHref(Math.min(totalPages, page + 1))} className={`rounded-md border px-3 py-2 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}>Next</Link></div>}
    </div>
  );
}
