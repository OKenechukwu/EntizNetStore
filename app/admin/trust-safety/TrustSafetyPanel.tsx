"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Review = {
  id: string;
  product_id: string;
  buyer_id: string;
  order_id: string | null;
  rating: number;
  title: string | null;
  content: string | null;
  is_verified_purchase: boolean;
  is_anonymous: boolean;
  status: string;
  moderation_notes: string | null;
  created_at: string;
};

type Report = {
  id: string;
  reporter_user_id: string;
  subject_type: string;
  subject_id: string;
  reason_code: string;
  details: string | null;
  priority: string;
  status: string;
  resolution_notes: string | null;
  created_at: string;
};

type Rule = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  severity: "low" | "medium" | "high" | "critical";
  default_action: "warn" | "unpublish" | "reject";
  is_active: boolean;
};

type Product = {
  id: string;
  title: string;
  slug: string;
  status: string;
  moderation_status: string;
  seller_id: string;
};

type RuleForm = {
  ruleId: string;
  code: string;
  title: string;
  description: string;
  severity: Rule["severity"];
  defaultAction: Rule["default_action"];
  isActive: boolean;
};

const emptyRule: RuleForm = {
  ruleId: "",
  code: "",
  title: "",
  description: "",
  severity: "high",
  defaultAction: "reject",
  isActive: true,
};

async function apiError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return typeof body?.error === "string" ? body.error : fallback;
}

export default function TrustSafetyPanel() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviewStatus, setReviewStatus] = useState("pending");
  const [reportStatus, setReportStatus] = useState("active");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState<RuleForm>(emptyRule);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ reviewStatus, reportStatus });
      const response = await fetch(`/api/admin/trust-safety?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error(await apiError(response, "Unable to load Trust & Safety operations"));
      const body = await response.json();
      setReviews(body.reviews ?? []);
      setReports(body.reports ?? []);
      setRules(body.rules ?? []);
      setProducts(body.products ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load Trust & Safety operations");
    } finally {
      setLoading(false);
    }
  }, [reviewStatus, reportStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const activeRules = rules.filter((rule) => rule.is_active);

  async function action(payload: Record<string, unknown>, success: string, key: string) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/trust-safety", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await apiError(response, "Trust & Safety action failed"));
      setNotice(success);
      await load();
      return true;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Trust & Safety action failed");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function moderateReview(review: Review, decision: "approved" | "rejected") {
    const notes = window.prompt(
      decision === "rejected" ? "Rejection reason (required)" : "Moderation note (optional)",
      decision === "approved" ? "Verified-purchase review approved" : "",
    );
    if (notes === null) return;
    if (decision === "rejected" && !notes.trim()) {
      setError("Rejection notes are required.");
      return;
    }
    await action({ action: "moderateReview", reviewId: review.id, decision, notes }, `Review ${decision}.`, `review:${review.id}`);
  }

  async function transitionReport(report: Report, status: "in_review" | "resolved" | "dismissed") {
    const notes = status === "in_review"
      ? null
      : window.prompt(status === "resolved" ? "Resolution notes (required)" : "Dismissal reason (required)", "");
    if (status !== "in_review" && notes === null) return;
    if (status !== "in_review" && !notes?.trim()) {
      setError("Resolution notes are required.");
      return;
    }
    await action({
      action: "transitionReport",
      reportId: report.id,
      status,
      priority: report.priority,
      notes,
      metadata: { source: "admin_trust_safety_console" },
    }, `Report moved to ${status.replace("_", " ")}.`, `report:${report.id}`);
  }

  async function enforceProduct(report: Report) {
    if (report.subject_type !== "product") return;
    const ruleId = window.prompt(
      `Active rule ID (${activeRules.map((rule) => `${rule.code}: ${rule.id}`).join(" | ")})`,
      activeRules[0]?.id ?? "",
    );
    if (!ruleId) return;
    const rule = activeRules.find((item) => item.id === ruleId);
    if (!rule) {
      setError("Choose a currently active prohibited-product rule.");
      return;
    }
    const requested = window.prompt("Action: warn, unpublish, or reject", rule.default_action);
    if (!requested || !["warn", "unpublish", "reject"].includes(requested)) return;
    const notes = window.prompt(
      requested === "warn" ? "Enforcement note (optional)" : "Enforcement reason (required)",
      report.details ?? "",
    );
    if (notes === null) return;
    if (requested !== "warn" && !notes.trim()) {
      setError("Enforcement notes are required for takedown/rejection.");
      return;
    }
    await action({
      action: "enforceProduct",
      productId: report.subject_id,
      ruleId,
      enforcementAction: requested,
      notes,
      reportId: report.id,
    }, `Product enforcement completed: ${requested}.`, `enforce:${report.id}`);
  }

  function editRule(rule: Rule) {
    setRuleForm({
      ruleId: rule.id,
      code: rule.code,
      title: rule.title,
      description: rule.description ?? "",
      severity: rule.severity,
      defaultAction: rule.default_action,
      isActive: rule.is_active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveRule(event: FormEvent) {
    event.preventDefault();
    const ok = await action({
      action: "saveRule",
      ruleId: ruleForm.ruleId || null,
      code: ruleForm.code,
      title: ruleForm.title,
      description: ruleForm.description || null,
      severity: ruleForm.severity,
      defaultAction: ruleForm.defaultAction,
      isActive: ruleForm.isActive,
    }, ruleForm.ruleId ? "Policy rule updated and audited." : "Policy rule created and audited.", "rule:save");
    if (ok) setRuleForm(emptyRule);
  }

  return (
    <div className="space-y-10">
      {error && <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">{notice}</div>}

      <section className="rounded-xl border p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div><h2 className="text-xl font-semibold">Review moderation</h2><p className="text-sm opacity-65">Verified-purchase reviews are pending until approved.</p></div>
          <label className="text-sm">Status<select className="ml-2 rounded-md border bg-transparent px-2 py-1" value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All</option></select></label>
        </div>
        {loading ? <p className="py-6 text-sm opacity-65">Loading reviews…</p> : reviews.length === 0 ? <p className="py-6 text-sm opacity-65">No reviews in this queue.</p> : <div className="space-y-3">{reviews.map((review) => { const product = productMap.get(review.product_id); return <article key={review.id} className="rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-medium">{product?.title ?? review.product_id}</div><div className="mt-1 text-xs opacity-60">{review.rating}/5 · {review.is_verified_purchase ? "Verified purchase" : "Unverified"} · Buyer {review.is_anonymous ? "anonymous" : review.buyer_id}</div></div><span className="rounded-full border px-2 py-1 text-xs">{review.status}</span></div>{review.title && <h3 className="mt-3 font-medium">{review.title}</h3>}{review.content && <p className="mt-1 whitespace-pre-wrap text-sm opacity-80">{review.content}</p>}{review.status === "pending" && <div className="mt-4 flex gap-2"><button disabled={busy === `review:${review.id}`} className="rounded-md border border-emerald-500/50 px-3 py-1.5 text-sm" onClick={() => void moderateReview(review, "approved")}>Approve</button><button disabled={busy === `review:${review.id}`} className="rounded-md border border-red-500/50 px-3 py-1.5 text-sm" onClick={() => void moderateReview(review, "rejected")}>Reject</button></div>}</article>; })}</div>}
      </section>

      <section className="rounded-xl border p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div><h2 className="text-xl font-semibold">Marketplace reports</h2><p className="text-sm opacity-65">Triage reports, assign priority and enforce prohibited-product rules without deleting evidence.</p></div>
          <label className="text-sm">Queue<select className="ml-2 rounded-md border bg-transparent px-2 py-1" value={reportStatus} onChange={(e) => setReportStatus(e.target.value)}><option value="active">Open + in review</option><option value="open">Open</option><option value="in_review">In review</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option><option value="all">All</option></select></label>
        </div>
        {loading ? <p className="py-6 text-sm opacity-65">Loading reports…</p> : reports.length === 0 ? <p className="py-6 text-sm opacity-65">No reports in this queue.</p> : <div className="space-y-3">{reports.map((report) => { const product = report.subject_type === "product" ? productMap.get(report.subject_id) : null; return <article key={report.id} className="rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-medium">{report.subject_type === "product" ? product?.title ?? report.subject_id : `${report.subject_type}: ${report.subject_id}`}</div><div className="mt-1 text-xs opacity-60">{report.reason_code.replaceAll("_", " ")} · priority {report.priority} · reporter {report.reporter_user_id}</div></div><span className="rounded-full border px-2 py-1 text-xs">{report.status.replace("_", " ")}</span></div>{report.details && <p className="mt-3 whitespace-pre-wrap text-sm opacity-80">{report.details}</p>}{["open", "in_review"].includes(report.status) && <div className="mt-4 flex flex-wrap gap-2">{report.status === "open" && <button disabled={busy === `report:${report.id}`} className="rounded-md border px-3 py-1.5 text-sm" onClick={() => void transitionReport(report, "in_review")}>Take for review</button>}{report.subject_type === "product" && activeRules.length > 0 && <button disabled={busy === `enforce:${report.id}`} className="rounded-md border border-amber-500/50 px-3 py-1.5 text-sm" onClick={() => void enforceProduct(report)}>Enforce product rule</button>}<button disabled={busy === `report:${report.id}`} className="rounded-md border border-emerald-500/50 px-3 py-1.5 text-sm" onClick={() => void transitionReport(report, "resolved")}>Resolve</button><button disabled={busy === `report:${report.id}`} className="rounded-md border border-red-500/40 px-3 py-1.5 text-sm" onClick={() => void transitionReport(report, "dismissed")}>Dismiss</button></div>}</article>; })}</div>}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <form onSubmit={saveRule} className="space-y-4 rounded-xl border p-5">
          <div><h2 className="text-xl font-semibold">{ruleForm.ruleId ? "Edit prohibited-product rule" : "Create prohibited-product rule"}</h2><p className="mt-1 text-sm opacity-65">Rules define the policy basis; enforcement remains a separate audited Admin decision.</p></div>
          <label className="block text-sm">Code<input className="mt-1 w-full rounded-md border bg-transparent px-3 py-2" value={ruleForm.code} onChange={(e) => setRuleForm((v) => ({ ...v, code: e.target.value }))} placeholder="counterfeit_goods" required /></label>
          <label className="block text-sm">Title<input className="mt-1 w-full rounded-md border bg-transparent px-3 py-2" value={ruleForm.title} onChange={(e) => setRuleForm((v) => ({ ...v, title: e.target.value }))} required /></label>
          <label className="block text-sm">Description<textarea className="mt-1 min-h-24 w-full rounded-md border bg-transparent px-3 py-2" value={ruleForm.description} onChange={(e) => setRuleForm((v) => ({ ...v, description: e.target.value }))} /></label>
          <div className="grid grid-cols-2 gap-3"><label className="text-sm">Severity<select className="mt-1 w-full rounded-md border bg-transparent px-3 py-2" value={ruleForm.severity} onChange={(e) => setRuleForm((v) => ({ ...v, severity: e.target.value as Rule["severity"] }))}><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label><label className="text-sm">Default action<select className="mt-1 w-full rounded-md border bg-transparent px-3 py-2" value={ruleForm.defaultAction} onChange={(e) => setRuleForm((v) => ({ ...v, defaultAction: e.target.value as Rule["default_action"] }))}><option>warn</option><option>unpublish</option><option>reject</option></select></label></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ruleForm.isActive} onChange={(e) => setRuleForm((v) => ({ ...v, isActive: e.target.checked }))} /> Active rule</label>
          <div className="flex gap-2"><button disabled={busy === "rule:save"} className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black">{busy === "rule:save" ? "Saving…" : ruleForm.ruleId ? "Save rule" : "Create rule"}</button>{ruleForm.ruleId && <button type="button" className="rounded-md border px-4 py-2 text-sm" onClick={() => setRuleForm(emptyRule)}>Cancel</button>}</div>
        </form>

        <div className="rounded-xl border p-5"><div className="mb-4"><h2 className="text-xl font-semibold">Prohibited-product rules</h2><p className="text-sm opacity-65">{rules.length} policy rules · {activeRules.length} active</p></div>{rules.length === 0 ? <p className="py-6 text-sm opacity-65">No prohibited-product rules configured yet.</p> : <div className="space-y-2">{rules.map((rule) => <div key={rule.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{rule.title}</span><span className="rounded-full border px-2 py-0.5 text-xs">{rule.severity}</span><span className="rounded-full border px-2 py-0.5 text-xs">{rule.default_action}</span>{!rule.is_active && <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-xs">Inactive</span>}</div><p className="mt-1 text-xs opacity-60">{rule.code}</p>{rule.description && <p className="mt-2 text-sm opacity-70">{rule.description}</p>}</div><button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => editRule(rule)}>Edit</button></div>)}</div>}</div>
      </section>
    </div>
  );
}
