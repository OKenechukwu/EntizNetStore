"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type VariantOption = {
  productId: string;
  productTitle: string;
  variantId: string;
  variantTitle: string;
  sku: string | null;
  inventoryQuantity: number;
  retailPriceCents: number;
};

type OfferTier = {
  minimumQuantity: number;
  unitPriceCents: number;
};

type Offer = {
  id: string;
  productId: string;
  variantId: string;
  status: "draft" | "active" | "paused" | "archived";
  currency: string;
  minimumOrderQuantity: number;
  orderMultiple: number;
  unitLabel: string;
  casePackSize: number | null;
  leadTimeDays: number;
  incoterm: string | null;
  startsAt: string | null;
  endsAt: string | null;
  product: { id: string; title: string | null } | null;
  variant: { id: string; title: string | null; sku: string | null; inventory_quantity: number | null } | null;
  tiers: OfferTier[];
};

type OfferResponse = { offers?: Offer[]; error?: string; offerId?: string };

type TierDraft = { minimumQuantity: string; unitPrice: string };

type FormState = {
  offerId: string | null;
  variantKey: string;
  status: Offer["status"];
  minimumOrderQuantity: string;
  orderMultiple: string;
  unitLabel: string;
  casePackSize: string;
  leadTimeDays: string;
  incoterm: string;
  tiers: TierDraft[];
};

const incoterms = ["", "EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP", "FAS", "FOB", "CFR", "CIF"] as const;

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function emptyForm(variants: VariantOption[]): FormState {
  const first = variants[0] || null;
  return {
    offerId: null,
    variantKey: first ? `${first.productId}:${first.variantId}` : "",
    status: "draft",
    minimumOrderQuantity: "10",
    orderMultiple: "1",
    unitLabel: "unit",
    casePackSize: "",
    leadTimeDays: "0",
    incoterm: "",
    tiers: [{ minimumQuantity: "10", unitPrice: first ? dollars(first.retailPriceCents) : "" }],
  };
}

async function readJson(response: Response): Promise<OfferResponse> {
  return response.json().catch(() => ({}));
}

export default function WholesaleOfferManager({ variants }: { variants: VariantOption[] }) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [form, setForm] = useState<FormState>(() => emptyForm(variants));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedVariant = useMemo(
    () => variants.find((variant) => `${variant.productId}:${variant.variantId}` === form.variantKey) || null,
    [form.variantKey, variants],
  );

  const loadOffers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/bsm/wholesale/offers", { cache: "no-store" });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload.error || "Unable to load wholesale offers");
      setOffers(payload.offers || []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load wholesale offers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void loadOffers(); });
  }, [loadOffers]);

  const reset = () => {
    setForm(emptyForm(variants));
    setNotice(null);
    setError(null);
  };

  const editOffer = (offer: Offer) => {
    setForm({
      offerId: offer.id,
      variantKey: `${offer.productId}:${offer.variantId}`,
      status: offer.status,
      minimumOrderQuantity: String(offer.minimumOrderQuantity),
      orderMultiple: String(offer.orderMultiple),
      unitLabel: offer.unitLabel,
      casePackSize: offer.casePackSize ? String(offer.casePackSize) : "",
      leadTimeDays: String(offer.leadTimeDays),
      incoterm: offer.incoterm || "",
      tiers: offer.tiers.map((tier) => ({
        minimumQuantity: String(tier.minimumQuantity),
        unitPrice: dollars(tier.unitPriceCents),
      })),
    });
    setNotice(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateTier = (index: number, field: keyof TierDraft, value: string) => {
    setForm((current) => ({
      ...current,
      tiers: current.tiers.map((tier, tierIndex) => tierIndex === index ? { ...tier, [field]: value } : tier),
    }));
  };

  const addTier = () => {
    setForm((current) => {
      const last = current.tiers[current.tiers.length - 1];
      const multiple = Math.max(1, Number(current.orderMultiple) || 1);
      const lastMinimum = Math.max(Number(current.minimumOrderQuantity) || 1, Number(last?.minimumQuantity) || 0);
      return {
        ...current,
        tiers: [
          ...current.tiers,
          { minimumQuantity: String(lastMinimum + multiple), unitPrice: last?.unitPrice || "" },
        ],
      };
    });
  };

  const removeTier = (index: number) => {
    setForm((current) => ({ ...current, tiers: current.tiers.filter((_, tierIndex) => tierIndex !== index) }));
  };

  const save = async () => {
    if (!selectedVariant) {
      setError("Choose one approved product variant for this wholesale offer.");
      return;
    }

    const minimumOrderQuantity = Number(form.minimumOrderQuantity);
    const orderMultiple = Number(form.orderMultiple);
    const leadTimeDays = Number(form.leadTimeDays);
    const casePackSize = form.casePackSize.trim() ? Number(form.casePackSize) : null;

    if (!Number.isInteger(minimumOrderQuantity) || minimumOrderQuantity < 1 || minimumOrderQuantity > 100000) {
      setError("MOQ must be a whole number between 1 and 100,000.");
      return;
    }
    if (!Number.isInteger(orderMultiple) || orderMultiple < 1 || orderMultiple > 100000) {
      setError("Order multiple must be a whole number between 1 and 100,000.");
      return;
    }
    if (minimumOrderQuantity % orderMultiple !== 0) {
      setError("MOQ must be divisible by the order multiple.");
      return;
    }
    if (!Number.isInteger(leadTimeDays) || leadTimeDays < 0 || leadTimeDays > 365) {
      setError("Lead time must be between 0 and 365 days.");
      return;
    }
    if (casePackSize !== null && (!Number.isInteger(casePackSize) || casePackSize < 1 || casePackSize > 100000)) {
      setError("Case pack size must be a whole number between 1 and 100,000.");
      return;
    }

    const tiers = form.tiers.map((tier, index) => {
      const minimumQuantity = index === 0 ? minimumOrderQuantity : Number(tier.minimumQuantity);
      const unitPriceCents = Math.round(Number(tier.unitPrice) * 100);
      return { minimumQuantity, unitPriceCents };
    });

    if (tiers.length === 0 || tiers.length > 20 || tiers.some((tier) =>
      !Number.isInteger(tier.minimumQuantity)
      || tier.minimumQuantity < minimumOrderQuantity
      || tier.minimumQuantity > 100000
      || (tier.minimumQuantity - minimumOrderQuantity) % orderMultiple !== 0
      || !Number.isInteger(tier.unitPriceCents)
      || tier.unitPriceCents < 1
    )) {
      setError("Every price tier must use a valid quantity aligned to the order multiple and a price greater than zero.");
      return;
    }

    const sorted = [...tiers].sort((a, b) => a.minimumQuantity - b.minimumQuantity);
    if (sorted[0]?.minimumQuantity !== minimumOrderQuantity || new Set(sorted.map((tier) => tier.minimumQuantity)).size !== sorted.length) {
      setError("The first price tier must start at the MOQ and tier quantities must be unique.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/bsm/wholesale/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: form.offerId,
          productId: selectedVariant.productId,
          variantId: selectedVariant.variantId,
          status: form.status,
          minimumOrderQuantity,
          orderMultiple,
          unitLabel: form.unitLabel.trim(),
          casePackSize,
          leadTimeDays,
          incoterm: form.incoterm || null,
          startsAt: null,
          endsAt: null,
          tiers: sorted,
        }),
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload.error || "Unable to save wholesale offer");
      setNotice(form.offerId ? "Wholesale offer updated." : "Wholesale offer created.");
      setForm(emptyForm(variants));
      await loadOffers();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save wholesale offer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="glass-card p-6 md:p-8" aria-labelledby="wholesale-offer-editor-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent-gold">Seller-owned B2B terms</p>
            <h2 id="wholesale-offer-editor-heading" className="mt-1 font-serif text-2xl font-bold">
              {form.offerId ? "Edit wholesale offer" : "Create wholesale offer"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm opacity-70">
              Offers attach to your existing approved product variants. Prices are stored as server-authoritative tiers and revalidated again at checkout.
            </p>
          </div>
          {form.offerId ? (
            <button type="button" onClick={reset} className="luxury-button-outline min-h-11 px-4">New offer</button>
          ) : null}
        </div>

        {error ? <div role="alert" className="mt-5 rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div> : null}
        {notice ? <div role="status" className="mt-5 rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</div> : null}

        {variants.length === 0 ? (
          <div className="mt-6 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm">
            You need at least one active, approved product variant before creating a wholesale offer.
          </div>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">Product variant</span>
              <select
                value={form.variantKey}
                onChange={(event) => {
                  const next = variants.find((variant) => `${variant.productId}:${variant.variantId}` === event.target.value) || null;
                  setForm((current) => ({
                    ...current,
                    variantKey: event.target.value,
                    tiers: current.offerId || !next
                      ? current.tiers
                      : current.tiers.map((tier, index) => index === 0 ? { ...tier, unitPrice: dollars(next.retailPriceCents) } : tier),
                  }));
                }}
                className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-3"
              >
                {variants.map((variant) => (
                  <option key={variant.variantId} value={`${variant.productId}:${variant.variantId}`}>
                    {variant.productTitle} — {variant.variantTitle}{variant.sku ? ` (${variant.sku})` : ""} — inventory {variant.inventoryQuantity}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Offer status</span>
              <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as Offer["status"] }))} className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-3">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Unit label</span>
              <input value={form.unitLabel} onChange={(event) => setForm((current) => ({ ...current, unitLabel: event.target.value }))} maxLength={40} className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-3" placeholder="unit, box, case…" />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Minimum order quantity (MOQ)</span>
              <input type="number" min={1} max={100000} value={form.minimumOrderQuantity} onChange={(event) => setForm((current) => ({ ...current, minimumOrderQuantity: event.target.value, tiers: current.tiers.map((tier, index) => index === 0 ? { ...tier, minimumQuantity: event.target.value } : tier) }))} className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-3" />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Order multiple</span>
              <input type="number" min={1} max={100000} value={form.orderMultiple} onChange={(event) => setForm((current) => ({ ...current, orderMultiple: event.target.value }))} className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-3" />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Case pack size <span className="opacity-60">(optional)</span></span>
              <input type="number" min={1} max={100000} value={form.casePackSize} onChange={(event) => setForm((current) => ({ ...current, casePackSize: event.target.value }))} className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-3" />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Lead time (days)</span>
              <input type="number" min={0} max={365} value={form.leadTimeDays} onChange={(event) => setForm((current) => ({ ...current, leadTimeDays: event.target.value }))} className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-3" />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Incoterm <span className="opacity-60">(optional)</span></span>
              <select value={form.incoterm} onChange={(event) => setForm((current) => ({ ...current, incoterm: event.target.value }))} className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-3">
                {incoterms.map((term) => <option key={term || "none"} value={term}>{term || "Not specified"}</option>)}
              </select>
            </label>
          </div>
        )}

        {variants.length > 0 ? (
          <div className="mt-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Quantity price tiers</h3>
                <p className="mt-1 text-xs opacity-65">The first tier always begins at the MOQ. Higher tiers must follow the order multiple.</p>
              </div>
              <button type="button" onClick={addTier} disabled={form.tiers.length >= 20} className="luxury-button-outline min-h-11 px-4 disabled:opacity-50">Add tier</button>
            </div>

            <div className="mt-4 space-y-3">
              {form.tiers.map((tier, index) => (
                <div key={index} className="grid gap-3 rounded-xl border border-white/10 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <label className="space-y-2">
                    <span className="text-xs font-medium">Minimum quantity</span>
                    <input
                      type="number"
                      min={1}
                      max={100000}
                      value={index === 0 ? form.minimumOrderQuantity : tier.minimumQuantity}
                      disabled={index === 0}
                      onChange={(event) => updateTier(index, "minimumQuantity", event.target.value)}
                      className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-3 disabled:opacity-60"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-medium">USD unit price</span>
                    <input type="number" min="0.01" step="0.01" value={tier.unitPrice} onChange={(event) => updateTier(index, "unitPrice", event.target.value)} className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-3" />
                  </label>
                  <button type="button" onClick={() => removeTier(index)} disabled={form.tiers.length === 1 || index === 0} className="min-h-11 px-3 text-sm text-red-300 disabled:opacity-30">Remove</button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <button type="button" onClick={() => void save()} disabled={saving || variants.length === 0} className="luxury-button mt-6 min-h-11 px-6 disabled:opacity-50">
          {saving ? "Saving…" : form.offerId ? "Save offer changes" : "Create wholesale offer"}
        </button>
      </section>

      <section className="glass-card p-6 md:p-8" aria-labelledby="current-wholesale-offers-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="current-wholesale-offers-heading" className="font-serif text-2xl font-bold">Current wholesale offers</h2>
            <p className="mt-2 text-sm opacity-70">Only eligible verified Business buyers can read active offer pricing.</p>
          </div>
          <button type="button" onClick={() => void loadOffers()} disabled={loading} className="luxury-button-outline min-h-11 px-4 disabled:opacity-50">{loading ? "Refreshing…" : "Refresh"}</button>
        </div>

        {loading && offers.length === 0 ? <p className="mt-5 text-sm opacity-70">Loading offers…</p> : null}
        {!loading && offers.length === 0 ? <p className="mt-5 text-sm opacity-70">No wholesale offers yet.</p> : null}

        <div className="mt-5 space-y-4">
          {offers.map((offer) => (
            <article key={offer.id} className="rounded-xl border border-white/10 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{offer.product?.title || "Product"} — {offer.variant?.title || "Variant"}</h3>
                    <span className="rounded-full border border-white/15 px-2 py-0.5 text-xs capitalize">{offer.status}</span>
                  </div>
                  <p className="mt-1 text-xs opacity-65">{offer.variant?.sku ? `SKU ${offer.variant.sku} · ` : ""}MOQ {offer.minimumOrderQuantity} · multiple {offer.orderMultiple} · lead {offer.leadTimeDays} days{offer.incoterm ? ` · ${offer.incoterm}` : ""}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {offer.tiers.map((tier) => (
                      <span key={tier.minimumQuantity} className="rounded-lg bg-white/5 px-2.5 py-1.5">{tier.minimumQuantity}+ @ ${dollars(tier.unitPriceCents)}</span>
                    ))}
                  </div>
                </div>
                <button type="button" onClick={() => editOffer(offer)} className="luxury-button-outline min-h-11 px-4">Edit</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
