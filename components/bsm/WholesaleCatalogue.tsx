"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Price from "@/components/common/Price";
import { setCanonicalWholesaleCartItem } from "@/lib/cart/client";

type Tier = { minimumQuantity: number; unitPriceCents: number };

type CatalogueOffer = {
  id: string;
  sellerId: string;
  productId: string;
  variantId: string;
  currency: string;
  minimumOrderQuantity: number;
  orderMultiple: number;
  unitLabel: string;
  casePackSize: number | null;
  leadTimeDays: number;
  incoterm: string | null;
  product: {
    id: string;
    title: string | null;
    slug: string | null;
    requires_shipping: boolean | null;
  } | null;
  variant: {
    id: string;
    title: string | null;
    sku: string | null;
    inventory_quantity: number | null;
    track_inventory: boolean | null;
    inventory_policy: string | null;
  } | null;
  seller: {
    id: string;
    display_name: string | null;
    business_kind: string | null;
    logo_url: string | null;
    country: string | null;
  } | null;
  image: string | null;
  tiers: Tier[];
};

type CatalogueResponse = { offers?: CatalogueOffer[]; error?: string };

async function readJson(response: Response): Promise<CatalogueResponse> {
  return response.json().catch(() => ({}));
}

function activeTier(offer: CatalogueOffer, quantity: number): Tier | null {
  return [...offer.tiers]
    .sort((a, b) => a.minimumQuantity - b.minimumQuantity)
    .filter((tier) => tier.minimumQuantity <= quantity)
    .at(-1) || null;
}

export default function WholesaleCatalogue() {
  const [offers, setOffers] = useState<CatalogueOffer[]>([]);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busyOffer, setBusyOffer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (search: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      params.set("limit", "50");
      const response = await fetch(`/api/bsm/wholesale/catalog?${params.toString()}`, { cache: "no-store" });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload.error || "Unable to load wholesale catalogue");
      const nextOffers = payload.offers || [];
      setOffers(nextOffers);
      setQuantities((current) => {
        const next = { ...current };
        for (const offer of nextOffers) {
          if (!next[offer.id]) next[offer.id] = offer.minimumOrderQuantity;
        }
        return next;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load wholesale catalogue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void load(""); });
  }, [load]);

  const visibleOfferCount = useMemo(() => offers.length, [offers]);

  const search = (event: FormEvent) => {
    event.preventDefault();
    setSubmittedQuery(query.trim());
    setNotice(null);
    void load(query);
  };

  const setQuantity = (offer: CatalogueOffer, quantity: number) => {
    if (!Number.isInteger(quantity)) return;
    setQuantities((current) => ({ ...current, [offer.id]: quantity }));
  };

  const addToCart = async (offer: CatalogueOffer) => {
    const quantity = quantities[offer.id] || offer.minimumOrderQuantity;
    if (quantity < offer.minimumOrderQuantity || quantity > 100000) {
      setError(`Quantity must be between the MOQ (${offer.minimumOrderQuantity}) and 100,000.`);
      return;
    }
    if ((quantity - offer.minimumOrderQuantity) % offer.orderMultiple !== 0) {
      setError(`Quantity must follow this offer's order multiple of ${offer.orderMultiple}.`);
      return;
    }

    setBusyOffer(offer.id);
    setError(null);
    setNotice(null);
    try {
      await setCanonicalWholesaleCartItem({ offerId: offer.id, quantity });
      setNotice(`${offer.product?.title || "Wholesale item"} was added to your secure cart at quantity ${quantity}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add wholesale item to cart");
    } finally {
      setBusyOffer(null);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={search} className="glass-card p-5" role="search">
        <label htmlFor="wholesale-search" className="text-sm font-semibold">Search wholesale catalogue</label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="wholesale-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={100}
            placeholder="Product, SKU, supplier or manufacturer"
            className="min-h-11 flex-1 rounded-lg border border-white/15 bg-black/20 px-3"
          />
          <button type="submit" disabled={loading} className="luxury-button min-h-11 px-6 disabled:opacity-50">
            {loading ? "Loading…" : "Search"}
          </button>
          {submittedQuery ? (
            <button
              type="button"
              onClick={() => { setQuery(""); setSubmittedQuery(""); void load(""); }}
              className="luxury-button-outline min-h-11 px-4"
            >
              Clear
            </button>
          ) : null}
        </div>
      </form>

      {error ? <div role="alert" className="rounded-lg border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-300">{error}</div> : null}
      {notice ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          <span>{notice}</span>
          <Link href="/cart" className="font-semibold underline">View cart</Link>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-bold">Available B2B inventory</h2>
          <p className="mt-1 text-sm opacity-70">
            {loading ? "Refreshing verified wholesale offers…" : `${visibleOfferCount} eligible offer${visibleOfferCount === 1 ? "" : "s"} found.`}
          </p>
        </div>
        <p className="max-w-xl text-xs opacity-60">
          Prices shown here are Business-only. MOQ, trading eligibility, Seller verification, tier price and inventory are revalidated server-side when you add to cart and again at checkout.
        </p>
      </div>

      {!loading && offers.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <h3 className="font-semibold">No matching wholesale offers</h3>
          <p className="mt-2 text-sm opacity-65">Try another search or check back as verified BSM suppliers publish inventory.</p>
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {offers.map((offer) => {
          const quantity = quantities[offer.id] || offer.minimumOrderQuantity;
          const tier = activeTier(offer, quantity);
          const unitPrice = (tier?.unitPriceCents || 0) / 100;
          const lineTotal = unitPrice * quantity;
          const productHref = offer.product?.slug ? `/product/${offer.product.slug}` : null;
          const nextDecrease = quantity - offer.orderMultiple;
          const nextIncrease = quantity + offer.orderMultiple;
          const cannotDecrease = nextDecrease < offer.minimumOrderQuantity;
          const cannotIncrease = nextIncrease > 100000;

          return (
            <article key={offer.id} className="glass-card overflow-hidden">
              <div className="aspect-[4/3] bg-white/5">
                {offer.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={offer.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-5xl" aria-hidden="true">📦</div>
                )}
              </div>
              <div className="p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 font-semibold text-accent-gold">Verified B2B</span>
                  {offer.seller?.business_kind ? <span className="capitalize opacity-65">{offer.seller.business_kind}</span> : null}
                </div>

                <h3 className="mt-3 text-lg font-semibold">
                  {productHref ? <Link href={productHref} className="hover:underline">{offer.product?.title || "Wholesale product"}</Link> : offer.product?.title || "Wholesale product"}
                </h3>
                <p className="mt-1 text-sm opacity-70">{offer.variant?.title || "Variant"}{offer.variant?.sku ? ` · ${offer.variant.sku}` : ""}</p>
                <p className="mt-2 text-sm font-medium text-accent-gold">{offer.seller?.display_name || "Verified Business"}{offer.seller?.country ? ` · ${offer.seller.country}` : ""}</p>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs opacity-75">
                  <span>MOQ <strong>{offer.minimumOrderQuantity}</strong></span>
                  <span>Multiple <strong>{offer.orderMultiple}</strong></span>
                  <span>Lead <strong>{offer.leadTimeDays}d</strong></span>
                  <span>{offer.incoterm ? `Incoterm ${offer.incoterm}` : "Incoterm —"}</span>
                  {offer.casePackSize ? <span>Case pack <strong>{offer.casePackSize}</strong></span> : null}
                  <span>Unit <strong>{offer.unitLabel}</strong></span>
                </div>

                <div className="mt-4 rounded-lg border border-white/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-65">Quantity pricing</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {offer.tiers.map((priceTier) => (
                      <span key={priceTier.minimumQuantity} className={`rounded-md px-2 py-1 text-xs ${tier?.minimumQuantity === priceTier.minimumQuantity ? "bg-amber-500/20 text-accent-gold" : "bg-white/5"}`}>
                        {priceTier.minimumQuantity}+ · <Price amount={priceTier.unitPriceCents / 100} />
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-5">
                  <label htmlFor={`wholesale-quantity-${offer.id}`} className="text-sm font-medium">Order quantity</label>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Decrease ${offer.product?.title || "wholesale product"} quantity by ${offer.orderMultiple}`}
                      onClick={() => setQuantity(offer, nextDecrease)}
                      disabled={cannotDecrease || busyOffer === offer.id}
                      className="min-h-11 min-w-11 rounded-lg border border-white/15 disabled:opacity-40"
                    >−</button>
                    <input
                      id={`wholesale-quantity-${offer.id}`}
                      type="number"
                      min={offer.minimumOrderQuantity}
                      max={100000}
                      step={offer.orderMultiple}
                      value={quantity}
                      onChange={(event) => setQuantity(offer, Number(event.target.value))}
                      className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/15 bg-black/20 px-3 text-center"
                    />
                    <button
                      type="button"
                      aria-label={`Increase ${offer.product?.title || "wholesale product"} quantity by ${offer.orderMultiple}`}
                      onClick={() => setQuantity(offer, nextIncrease)}
                      disabled={cannotIncrease || busyOffer === offer.id}
                      className="min-h-11 min-w-11 rounded-lg border border-white/15 disabled:opacity-40"
                    >+</button>
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs opacity-60">Current tier</p>
                    <p className="font-semibold"><Price amount={unitPrice} /> / {offer.unitLabel}</p>
                    <p className="text-xs opacity-60">Line subtotal <Price amount={lineTotal} /></p>
                  </div>
                  <button type="button" onClick={() => void addToCart(offer)} disabled={busyOffer === offer.id || !tier} className="luxury-button min-h-11 px-4 disabled:opacity-50">
                    {busyOffer === offer.id ? "Adding…" : "Add wholesale"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
