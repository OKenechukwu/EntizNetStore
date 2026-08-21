// app/dashboard/bsm/vendors/actions.ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";

// ---------- Supabase server client ----------
async function sb() {
  return await createClient();
}

// ---------- Role gate (BSM only) ----------
async function assertBSM() {
  const gate = await requireRole(["brand", "supplier", "manufacturer", "bsm"]);
  if (!gate.ok) throw new Error("Forbidden: BSM role required.");
  return gate; // { ok, user }
}

// ---------- Helpers ----------
const money = (n: number) => Math.round(n * 100) / 100;

// ---------- Schemas (single-line RFQ) ----------
const CreateQuoteSchema = z.object({
  rfq_id: z.string().uuid(),
  // Per-unit price you're quoting
  unit_price: z.number().nonnegative(),
  // If omitted, we use rfq.quantity
  quantity: z.number().positive().optional(),
  // Totals meta
  currency: z.string().min(3).max(8), // e.g., EUR, USD, PHP
  shipping_cost: z.number().nonnegative().default(0),
  discount_amount: z.number().nonnegative().default(0),
  tax_percent: z.number().min(0).max(100).default(0),
  delivery_days: z.number().int().positive().default(7),
  valid_until: z.string().datetime().optional(), // ISO string
  notes: z.string().max(2000).optional(),
});

const UpdateQuoteStatusSchema = z.object({
  quotation_id: z.string().uuid(),
  status: z.enum([
    "draft",
    "sent",
    "accepted",
    "declined",
    "expired",
    "revised",
  ]),
});

const ListMyQuotesSchema = z.object({
  status: z
    .enum(["draft", "sent", "accepted", "declined", "expired", "revised"])
    .optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

// ---------- RFQ fetch (matches your table: rfq) ----------
export async function getRFQ(rfq_id: string) {
  await assertBSM();
  const supabase = await sb();

  const { data: rfq, error } = await supabase
    .from("rfq")
    .select(
      "id, title, details, status, quantity, target_price, currency, delivery_term, delivery_deadline, vendor_id, bsm_id, product_id, created_at",
    )
    .eq("id", rfq_id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!rfq) throw new Error("RFQ not found.");
  return rfq;
}

// ---------- Live preview (single-line math) ----------
export async function previewTotals(input: z.infer<typeof CreateQuoteSchema>) {
  await assertBSM();
  const parsed = CreateQuoteSchema.parse(input);
  const rfq = await getRFQ(parsed.rfq_id);

  const qty = Number(parsed.quantity ?? rfq.quantity ?? 1);
  const unit = Number(parsed.unit_price);
  const subtotal = money(qty * unit);
  const tax_amount = money((parsed.tax_percent / 100) * subtotal);
  const discount_amount = money(parsed.discount_amount || 0);
  const shipping_cost = money(parsed.shipping_cost || 0);
  const total = money(subtotal + tax_amount + shipping_cost - discount_amount);

  return {
    ok: true,
    currency: parsed.currency.toUpperCase(),
    quantity: qty,
    unit_price: unit,
    subtotal,
    tax_amount,
    discount_amount,
    shipping_cost,
    total,
  };
}

// ---------- Create quotation (no quotation_items table) ----------
export async function createQuotation(
  input: z.infer<typeof CreateQuoteSchema>,
) {
  const gate = await assertBSM();
  const parsed = CreateQuoteSchema.parse(input);
  const supabase = await sb();

  const rfq = await getRFQ(parsed.rfq_id);
  const qty = Number(parsed.quantity ?? rfq.quantity ?? 1);
  const unit = Number(parsed.unit_price);
  const subtotal = money(qty * unit);
  const tax_amount = money((parsed.tax_percent / 100) * subtotal);
  const discount_amount = money(parsed.discount_amount || 0);
  const shipping_cost = money(parsed.shipping_cost || 0);
  const total = money(subtotal + tax_amount + shipping_cost - discount_amount);

  const row = {
    rfq_id: parsed.rfq_id,
    status: "sent",
    currency: parsed.currency.toUpperCase(),
    unit_price: unit,
    quantity: qty,
    subtotal,
    tax_amount,
    discount_amount,
    shipping_cost,
    total,
    delivery_days: parsed.delivery_days,
    valid_until: parsed.valid_until ?? null,
    notes: parsed.notes ?? null,
    created_by: gate.user?.id ?? null,
  };

  const { data: q, error } = await supabase
    .from("quotations")
    .insert(row)
    .select("id, rfq_id, status, total, currency, created_at")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/bsm/quotes");
  revalidatePath(`/dashboard/bsm/rfqs/${parsed.rfq_id}`);
  return {
    ok: true,
    quotation_id: q.id,
    rfq_id: q.rfq_id,
    total: q.total,
    currency: q.currency,
  };
}

// ---------- Status & listing (BSM = “my quotes” = created_by) ----------
export async function updateQuotationStatus(
  input: z.infer<typeof UpdateQuoteStatusSchema>,
) {
  await assertBSM();
  const parsed = UpdateQuoteStatusSchema.parse(input);
  const supabase = await sb();
  const { error } = await supabase
    .from("quotations")
    .update({ status: parsed.status })
    .eq("id", parsed.quotation_id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/bsm/quotes");
  return { ok: true };
}

export async function listMyQuotations(
  input?: z.infer<typeof ListMyQuotesSchema>,
) {
  const gate = await assertBSM();
  const { status, limit, offset } = ListMyQuotesSchema.parse(input ?? {});
  const supabase = await sb();

  let q = supabase
    .from("quotations")
    .select("id, rfq_id, status, total, currency, created_at")
    .eq("created_by", gate.user?.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { ok: true, items: data ?? [] };
}
