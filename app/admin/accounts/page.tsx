import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import AccountCapabilityAction from "@/components/admin/AccountCapabilityAction";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type AccountRow = {
  user_id: string;
  email: string | null;
  auth_created_at: string;
  buyer_display_name: string | null;
  has_buyer: boolean;
  buyer_status: "active" | "suspended" | null;
  has_seller: boolean;
  seller_storefront_name: string | null;
  seller_verification_status: string | null;
  seller_status: "active" | "suspended" | null;
  has_business: boolean;
  business_display_name: string | null;
  business_verification_status: string | null;
  business_status: "active" | "suspended" | null;
  entiznet_user_id: string | null;
  entiznet_link_status: string | null;
  total_count: number | string;
};

function first(value: string | string[] | undefined, fallback = "") {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

function StatusPill({ value }: { value: string | null }) {
  if (!value) return <span className="text-xs text-foreground/70">—</span>;
  const good = value === "active" || value === "verified";
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${good ? "bg-emerald-100 text-emerald-800" : value === "suspended" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}

export default async function AdminAccountsPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/auth/sign-in");
  if (user.app_metadata?.role !== "admin") redirect("/store");

  const params = await searchParams;
  const query = first(params.query).slice(0, 200);
  const capability = ["all", "buyer", "seller", "business"].includes(first(params.capability, "all"))
    ? first(params.capability, "all")
    : "all";
  const status = ["all", "active", "suspended"].includes(first(params.status, "all"))
    ? first(params.status, "all")
    : "all";
  const page = Math.max(Number.parseInt(first(params.page, "1"), 10) || 1, 1);
  const perPage = 50;

  const admin = getSupabaseAdmin();
  const { data, error: searchError } = await admin.rpc("admin_search_marketplace_accounts", {
    p_admin_id: user.id,
    p_query: query,
    p_capability: capability,
    p_status: status,
    p_limit: perPage,
    p_offset: (page - 1) * perPage,
  });

  const accounts = (data ?? []) as AccountRow[];
  const total = Number(accounts[0]?.total_count ?? 0);
  const totalPages = Math.max(Math.ceil(total / perPage), 1);

  const makePageHref = (target: number) => {
    const next = new URLSearchParams();
    if (query) next.set("query", query);
    if (capability !== "all") next.set("capability", capability);
    if (status !== "all") next.set("status", status);
    if (target > 1) next.set("page", String(target));
    const qs = next.toString();
    return `/admin/accounts${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm text-sky-700 hover:underline">← Admin dashboard</Link>
          <h1 className="mt-2 text-3xl font-bold">Marketplace accounts</h1>
          <p className="mt-1 text-sm text-foreground/70">Buyer, Seller and Business capabilities are managed independently. EntizNet linkage is shown alongside local Store state.</p>
        </div>
        <div className="text-sm text-foreground/70">{total.toLocaleString()} account{total === 1 ? "" : "s"}</div>
      </div>

      <form className="mb-6 grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_180px_180px_auto]" method="get">
        <label className="sr-only" htmlFor="account-search-query">Search marketplace accounts</label>
        <input id="account-search-query" name="query" defaultValue={query} maxLength={200} placeholder="Email, name, Store UUID or EntizNet UUID" className="rounded-md border px-3 py-2" />
        <label className="sr-only" htmlFor="account-capability-filter">Filter by capability</label>
        <select id="account-capability-filter" name="capability" defaultValue={capability} className="rounded-md border px-3 py-2">
          <option value="all">All capabilities</option>
          <option value="buyer">Buyer</option>
          <option value="seller">Seller</option>
          <option value="business">Business</option>
        </select>
        <label className="sr-only" htmlFor="account-status-filter">Filter by account state</label>
        <select id="account-status-filter" name="status" defaultValue={status} className="rounded-md border px-3 py-2">
          <option value="all">All states</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800">Search</button>
      </form>

      {searchError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">Unable to load marketplace accounts. The operation has been logged server-side.</div>
      ) : accounts.length === 0 ? (
        <div className="rounded-xl border p-10 text-center">
          <h2 className="font-semibold">No accounts match these filters</h2>
          <p className="mt-1 text-sm text-foreground/70">Try a broader search or a different capability/state filter.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Buyer</th>
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">EntizNet</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {accounts.map((account) => (
                <tr key={account.user_id} className="align-top">
                  <td className="px-4 py-4">
                    <Link href={`/admin/accounts/${account.user_id}`} className="font-semibold text-sky-700 hover:underline">
                      {account.email || account.user_id}
                    </Link>
                    <div className="mt-1 max-w-56 truncate font-mono text-[11px] text-foreground/70" title={account.user_id}>{account.user_id}</div>
                  </td>
                  <td className="px-4 py-4">
                    {account.has_buyer ? <div className="space-y-2"><StatusPill value={account.buyer_status} /><div className="text-xs text-foreground/70">{account.buyer_display_name || "Buyer"}</div></div> : <span className="text-foreground/70">—</span>}
                  </td>
                  <td className="px-4 py-4">
                    {account.has_seller ? <div className="space-y-2"><StatusPill value={account.seller_status} /><StatusPill value={account.seller_verification_status} /><div className="text-xs text-foreground/70">{account.seller_storefront_name}</div></div> : <span className="text-foreground/70">—</span>}
                  </td>
                  <td className="px-4 py-4">
                    {account.has_business ? <div className="space-y-2"><StatusPill value={account.business_status} /><StatusPill value={account.business_verification_status} /><div className="text-xs text-foreground/70">{account.business_display_name}</div></div> : <span className="text-foreground/70">—</span>}
                  </td>
                  <td className="px-4 py-4">
                    {account.entiznet_user_id ? <div><StatusPill value={account.entiznet_link_status} /><div className="mt-2 max-w-44 truncate font-mono text-[11px] text-foreground/70" title={account.entiznet_user_id}>{account.entiznet_user_id}</div></div> : <span className="text-xs text-foreground/70">Standalone</span>}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex max-w-48 flex-col gap-2">
                      {account.has_buyer && account.buyer_status && <AccountCapabilityAction userId={account.user_id} capability="buyer" status={account.buyer_status} />}
                      {account.has_seller && account.seller_status && <AccountCapabilityAction userId={account.user_id} capability="seller" status={account.seller_status} />}
                      {account.has_business && account.business_status && <AccountCapabilityAction userId={account.user_id} capability="business" status={account.business_status} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between gap-3 text-sm">
          <Link aria-disabled={page <= 1} href={makePageHref(Math.max(page - 1, 1))} className={`rounded-md border px-3 py-2 ${page <= 1 ? "pointer-events-none text-foreground/70" : "hover:bg-slate-50"}`}>Previous</Link>
          <span>Page {page} of {totalPages}</span>
          <Link aria-disabled={page >= totalPages} href={makePageHref(Math.min(page + 1, totalPages))} className={`rounded-md border px-3 py-2 ${page >= totalPages ? "pointer-events-none text-foreground/70" : "hover:bg-slate-50"}`}>Next</Link>
        </div>
      )}
    </div>
  );
}
