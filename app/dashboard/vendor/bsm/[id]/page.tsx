// app/dashboard/vendor/bsm/[id]/page.tsx
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

// Types
type Company = {
  id: string;
  company_name: string | null;
  company_type: string | null;
  country: string | null;
  website?: string | null;
  categories?: string[] | null;
};

type RFQ = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string | null;
};

// Try to fetch RFQs aimed at this BSM via a join table (rfq_targets),
// then fall back to a direct column (rfqs.bsm_id).
async function fetchRFQsForBSM(
  supabase: ReturnType<typeof supabaseServer>,
  bsmCompanyId: string,
) {
  // 1) Attempt join-table pattern: rfq_targets (rfq_id, bsm_id) -> rfqs
  try {
    const { data: joined, error: jtErr } = await supabase
      .from("rfq_targets")
      .select(
        `
        rfq_id,
        rfqs!inner (
          id, title, status, created_at
        )
      `,
      )
      .eq("bsm_id", bsmCompanyId)
      .order("rfqs(created_at)", { ascending: false })
      .limit(10);

    if (!jtErr && joined && joined.length > 0) {
      const mapped: RFQ[] = joined.map((r: any) => r.rfqs).filter(Boolean);
      if (mapped.length > 0) return mapped;
    }
  } catch {
    // table may not exist, ignore and fall back
  }

  // 2) Fallback: direct column on rfqs (e.g., rfqs.bsm_id)
  try {
    const { data: rfqs, error: dirErr } = await supabase
      .from("rfqs")
      .select("id, title, status, created_at")
      .eq("bsm_id", bsmCompanyId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!dirErr && rfqs && rfqs.length > 0) {
      return rfqs as RFQ[];
    }
  } catch {
    // table may not exist — final fallback returns empty
  }

  return [] as RFQ[];
}

export default async function BSMDetail({
  params,
}: {
  params: { id: string };
}) {
  const supabase = supabaseServer();

  // Viewer info (for role-based UI)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerRole =
    (user?.user_metadata as any)?.role ?? (user as any)?.role ?? null;
  const isBSMViewer = ["brand", "supplier", "manufacturer", "bsm"].includes(
    viewerRole,
  );

  // Load BSM company profile
  const { data: company, error: companyErr } = await supabase
    .from("bsm_profile")
    .select("*")
    .eq("id", params.id)
    .maybeSingle<Company>();

  if (companyErr) {
    return (
      <div className="p-6 text-red-600">
        Error loading BSM profile: {companyErr.message}
      </div>
    );
  }
  if (!company) return <div className="p-6">Not found</div>;

  // Load RFQs for this BSM (defensive discovery)
  const rfqs = isBSMViewer ? await fetchRFQsForBSM(supabase, company.id) : [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          {company.company_name || "Company"}
        </h1>
        {company.company_type && (
          <div className="text-sm opacity-70">{company.company_type}</div>
        )}
        {company.country && <div className="text-sm">{company.country}</div>}
        {company.website && (
          <a
            href={company.website}
            className="text-blue-600 underline inline-block mt-1"
            target="_blank"
          >
            {company.website}
          </a>
        )}
      </div>

      {/* Categories */}
      {(company.categories?.length ?? 0) > 0 && (
        <div className="text-sm">
          <span className="font-medium">Categories:</span>{" "}
          {company.categories?.join(", ")}
        </div>
      )}

      {/* Vendor action: create RFQ */}
      <div className="mt-2">
        <a
          href={`/dashboard/vendor/rfq/new?bsm=${company.id}`}
          className="btn btn-primary"
        >
          Request Quotation (RFQ)
        </a>
      </div>

      {/* BSM viewer block: recent RFQs for this BSM with link to Reply */}
      {isBSMViewer && (
        <div className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold">
            Recent RFQs for your company
          </h2>
          {rfqs.length === 0 ? (
            <div className="text-sm opacity-70">
              No RFQs found for this company yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3">Title</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Created</th>
                    <th className="text-right p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rfqs.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-3">{r.title ?? "Untitled RFQ"}</td>
                      <td className="p-3">{r.status ?? "-"}</td>
                      <td className="p-3">
                        {r.created_at
                          ? new Date(r.created_at).toLocaleString()
                          : "-"}
                      </td>
                      <td className="p-3 text-right">
                        <Link
                          href={`/dashboard/bsm/rfqs/${r.id}/quote`}
                          className="text-primary underline"
                        >
                          Reply with Quotation
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            Tip: “Reply with Quotation” opens the dedicated BSM quote flow at
            <code> /dashboard/bsm/rfqs/[rfqId]/quote</code>.
          </div>
        </div>
      )}
    </div>
  );
}
