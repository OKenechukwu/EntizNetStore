import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  authenticateEntizNetAdminRequest,
  completeEntizNetAdminRequest,
  EntizNetAdminServiceError,
} from "@/lib/integrations/entiznet/adminService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const filtersSchema = z.object({
  query: z.string().trim().max(200).default(""),
  capability: z.enum(["all", "buyer", "seller", "business"]).default("all"),
  status: z.enum(["all", "active", "suspended"]).default("all"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: NextRequest) {
  let requestId: string | null = null;
  try {
    const url = new URL(request.url);
    const parsed = filtersSchema.safeParse({
      query: url.searchParams.get("query") ?? "",
      capability: url.searchParams.get("capability") ?? "all",
      status: url.searchParams.get("status") ?? "all",
      page: url.searchParams.get("page") ?? "1",
      perPage: url.searchParams.get("perPage") ?? "50",
    });
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid account filters" }, { status: 400 });
    }

    const auth = await authenticateEntizNetAdminRequest(request, "store.accounts.read");
    requestId = auth.requestId;
    const input = parsed.data;

    const { data, error } = await auth.admin.rpc("entiznet_admin_search_marketplace_accounts", {
      p_entiznet_admin_id: auth.claims.sub,
      p_query: input.query,
      p_capability: input.capability,
      p_status: input.status,
      p_limit: input.perPage,
      p_offset: (input.page - 1) * input.perPage,
    });
    if (error) throw new Error("store_account_search_failed");

    const rows = data ?? [];
    await completeEntizNetAdminRequest(requestId, "completed", null, {
      operation: "accounts.read",
      query_present: input.query.length > 0,
      capability: input.capability,
      status: input.status,
      page: input.page,
      per_page: input.perPage,
      returned: rows.length,
    });

    return NextResponse.json(
      {
        ok: true,
        accounts: rows,
        page: input.page,
        perPage: input.perPage,
        total: Number(rows[0]?.total_count ?? 0),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status = error instanceof EntizNetAdminServiceError ? error.status : 500;
    const code = error instanceof Error ? error.message : "admin_accounts_failed";
    if (requestId) await completeEntizNetAdminRequest(requestId, "rejected", code);
    return NextResponse.json(
      { ok: false, error: code },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
