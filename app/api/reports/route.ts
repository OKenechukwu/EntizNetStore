import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const reportSchema = z.object({
  subjectType: z.enum(["product", "review", "seller", "buyer", "order", "dispute", "content"]),
  subjectId: z.string().uuid(),
  reasonCode: z.enum(["prohibited_product", "counterfeit", "fraud", "spam", "abuse", "unsafe_content", "policy_violation", "other"]),
  details: z.string().trim().max(5000).nullable().optional(),
}).refine((value) => value.reasonCode !== "other" || Boolean(value.details?.trim()), {
  message: "Details are required for an Other report",
  path: ["details"],
});

function rpcStatus(error: { code?: string }) {
  if (error.code === "23505") return 409;
  if (error.code === "42501" || error.code === "28000") return 403;
  if (error.code === "22023") return 400;
  return 500;
}

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { data, error } = await supabase
    .from("marketplace_reports")
    .select("id,subject_type,subject_id,reason_code,details,priority,status,resolution_notes,resolution_metadata,resolved_at,created_at,updated_at")
    .eq("reporter_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Unable to load marketplace reports", error);
    return NextResponse.json({ error: "Unable to load reports" }, { status: 500 });
  }
  return NextResponse.json({ reports: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const { data: reportId, error } = await supabase.rpc("submit_marketplace_report", {
    p_subject_type: input.subjectType,
    p_subject_id: input.subjectId,
    p_reason_code: input.reasonCode,
    p_details: input.details || null,
  });

  if (error || !reportId) {
    if (error) return NextResponse.json({ error: error.message || "Unable to submit report" }, { status: rpcStatus(error) });
    return NextResponse.json({ error: "Unable to submit report" }, { status: 500 });
  }

  return NextResponse.json({ reportId, status: "open" }, { status: 201 });
}
