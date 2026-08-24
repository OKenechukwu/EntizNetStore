import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const adminActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("moderateReview"),
    reviewId: z.string().uuid(),
    decision: z.enum(["approved", "rejected"]),
    notes: z.string().trim().max(5000).nullable().optional(),
  }).refine((value) => value.decision !== "rejected" || Boolean(value.notes?.trim()), {
    message: "Rejection notes are required",
    path: ["notes"],
  }),
  z.object({
    action: z.literal("transitionReport"),
    reportId: z.string().uuid(),
    status: z.enum(["in_review", "resolved", "dismissed"]),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    notes: z.string().trim().max(10000).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  }).refine((value) => value.status === "in_review" || Boolean(value.notes?.trim()), {
    message: "Resolution notes are required",
    path: ["notes"],
  }),
  z.object({
    action: z.literal("saveRule"),
    ruleId: z.string().uuid().nullable().optional(),
    code: z.string().trim().min(1).max(100),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(10000).nullable().optional(),
    severity: z.enum(["low", "medium", "high", "critical"]),
    defaultAction: z.enum(["warn", "unpublish", "reject"]),
    isActive: z.boolean().default(true),
  }),
  z.object({
    action: z.literal("enforceProduct"),
    productId: z.string().uuid(),
    ruleId: z.string().uuid(),
    enforcementAction: z.enum(["warn", "unpublish", "reject"]),
    notes: z.string().trim().max(10000).nullable().optional(),
    reportId: z.string().uuid().nullable().optional(),
  }).refine((value) => value.enforcementAction === "warn" || Boolean(value.notes?.trim()), {
    message: "Enforcement notes are required",
    path: ["notes"],
  }),
]);

function statusForRpcError(error: { code?: string }) {
  if (error.code === "23505" || error.code === "23503") return 409;
  if (error.code === "42501" || error.code === "28000") return 403;
  if (error.code === "22023") return 400;
  return 500;
}

export async function GET(request: NextRequest) {
  const { user, errorResponse } = await requireAdmin();
  if (errorResponse || !user) return errorResponse;

  const url = new URL(request.url);
  const reviewStatus = url.searchParams.get("reviewStatus") || "pending";
  const reportStatus = url.searchParams.get("reportStatus") || "active";
  const admin = getSupabaseAdmin();

  let reviewsQuery = admin
    .from("reviews")
    .select("id,product_id,buyer_id,order_id,rating,title,content,is_verified_purchase,is_anonymous,status,moderation_notes,moderated_by,moderated_at,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (reviewStatus !== "all") reviewsQuery = reviewsQuery.eq("status", reviewStatus);

  let reportsQuery = admin
    .from("marketplace_reports")
    .select("id,reporter_user_id,subject_type,subject_id,reason_code,details,priority,status,assigned_admin_id,resolution_notes,resolution_metadata,resolved_at,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (reportStatus === "active") reportsQuery = reportsQuery.in("status", ["open", "in_review"]);
  else if (reportStatus !== "all") reportsQuery = reportsQuery.eq("status", reportStatus);

  const [reviewsResult, reportsResult, rulesResult] = await Promise.all([
    reviewsQuery,
    reportsQuery,
    admin
      .from("prohibited_product_rules")
      .select("id,code,title,description,severity,default_action,is_active,created_by,updated_by,created_at,updated_at")
      .order("is_active", { ascending: false })
      .order("severity", { ascending: false })
      .order("code")
      .limit(200),
  ]);

  const failure = reviewsResult.error || reportsResult.error || rulesResult.error;
  if (failure) {
    console.error("Unable to load Trust & Safety operations", failure);
    return NextResponse.json({ error: "Unable to load Trust & Safety operations" }, { status: 500 });
  }

  const productIds = Array.from(new Set([
    ...(reviewsResult.data ?? []).map((review) => review.product_id),
    ...(reportsResult.data ?? []).filter((report) => report.subject_type === "product").map((report) => report.subject_id),
  ].filter(Boolean)));

  let products: unknown[] = [];
  if (productIds.length > 0) {
    const { data, error } = await admin
      .from("products")
      .select("id,title,slug,status,moderation_status,seller_id")
      .in("id", productIds);
    if (error) {
      console.error("Unable to load Trust & Safety product context", error);
      return NextResponse.json({ error: "Unable to load product context" }, { status: 500 });
    }
    products = data ?? [];
  }

  return NextResponse.json({
    reviews: reviewsResult.data ?? [],
    reports: reportsResult.data ?? [],
    rules: rulesResult.data ?? [],
    products,
  });
}

export async function POST(request: NextRequest) {
  const { user, errorResponse } = await requireAdmin();
  if (errorResponse || !user) return errorResponse;

  const body = await request.json().catch(() => null);
  const parsed = adminActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Trust & Safety action", details: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const input = parsed.data;
  let result: { data: unknown; error: { code?: string; message?: string } | null };

  switch (input.action) {
    case "moderateReview":
      result = await admin.rpc("admin_moderate_review", {
        p_admin_id: user.id,
        p_review_id: input.reviewId,
        p_decision: input.decision,
        p_notes: input.notes || null,
      });
      break;
    case "transitionReport":
      result = await admin.rpc("admin_transition_marketplace_report", {
        p_admin_id: user.id,
        p_report_id: input.reportId,
        p_status: input.status,
        p_priority: input.priority,
        p_resolution_notes: input.notes || null,
        p_resolution_metadata: input.metadata,
      });
      break;
    case "saveRule":
      result = await admin.rpc("admin_save_prohibited_product_rule", {
        p_admin_id: user.id,
        p_rule_id: input.ruleId ?? null,
        p_code: input.code,
        p_title: input.title,
        p_description: input.description || null,
        p_severity: input.severity,
        p_default_action: input.defaultAction,
        p_is_active: input.isActive,
      });
      break;
    case "enforceProduct":
      result = await admin.rpc("admin_enforce_prohibited_product", {
        p_admin_id: user.id,
        p_product_id: input.productId,
        p_rule_id: input.ruleId,
        p_action: input.enforcementAction,
        p_notes: input.notes || null,
        p_report_id: input.reportId ?? null,
      });
      break;
  }

  if (result.error) {
    const status = statusForRpcError(result.error);
    if (status === 500) console.error("Trust & Safety action failed", result.error);
    return NextResponse.json({ error: result.error.message || "Trust & Safety action failed" }, { status });
  }

  return NextResponse.json({ success: true, data: result.data ?? null });
}
