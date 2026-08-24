import { NextRequest, NextResponse } from "next/server";
import {
  authenticateEntizNetAdminRequest,
  completeEntizNetAdminRequest,
  EntizNetAdminServiceError,
} from "@/lib/integrations/entiznet/adminService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let requestId: string | null = null;
  try {
    const auth = await authenticateEntizNetAdminRequest(request, "store.health");
    requestId = auth.requestId;

    await completeEntizNetAdminRequest(requestId, "completed", null, {
      operation: "health",
    });

    return NextResponse.json(
      { ok: true, service: "entiznetstore", boundary: "entiznet-admin-api" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status = error instanceof EntizNetAdminServiceError ? error.status : 500;
    const code = error instanceof Error ? error.message : "admin_health_failed";
    if (requestId) await completeEntizNetAdminRequest(requestId, "rejected", code);
    return NextResponse.json(
      { ok: false, error: code },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
