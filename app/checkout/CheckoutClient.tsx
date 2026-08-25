"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import CartPayment from "@/components/payments/CartPayment";
import I18nText from "@/components/i18n/I18nText";
import { T } from "@/components/i18n/I18nProvider";
import {
  activateBuyerCapability,
  loadCanonicalCartWithGuestImport,
} from "@/lib/cart/client";
import type { CanonicalCart } from "@/lib/cart/contracts";

type Address = {
  id: string;
  nickname: string | null;
  is_default: boolean;
  type: "shipping" | "billing" | "both";
  first_name: string;
  last_name: string;
  company: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state_province: string | null;
  postal_code: string;
  country: string;
  phone: string | null;
};

type CartQuote = {
  id: string;
  cart_id: string;
  cart_version: number;
  status: "ready" | "blocked" | "expired" | "consumed" | string;
  block_reasons: string[];
  currency: "usd";
  subtotal_cents: number;
  tax_cents: number;
  shipping_cents: number;
  discount_cents: number;
  total_cents: number;
  shipping_address: unknown;
  shipping_quote: unknown;
  tax_quote: unknown;
  expires_at: string;
  created_at: string;
};

type AddressDraft = {
  nickname: string;
  firstName: string;
  lastName: string;
  company: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  phone: string;
};

const EMPTY_ADDRESS: AddressDraft = {
  nickname: "",
  firstName: "",
  lastName: "",
  company: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  stateProvince: "",
  postalCode: "",
  country: "PH",
  phone: "",
};

function usd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function blockerMessage(reason: string): string {
  switch (reason) {
    case "cart_contains_unavailable_items":
      return "One or more cart items changed or are no longer available. Return to your cart and review them.";
    case "shipping_address_required":
      return "Choose or add a shipping address before requesting checkout totals.";
    case "shipping_quote_provider_unconfigured":
      return "Shipping-rate checkout is still closed until the launch shipping provider is activated.";
    case "shipping_quote_provider_not_implemented":
      return "The selected shipping-rate integration is not ready for checkout yet.";
    case "tax_quote_provider_unconfigured":
      return "Taxable checkout is still closed until the launch tax provider is activated.";
    case "tax_quote_provider_not_implemented":
      return "The selected tax integration is not ready for checkout yet.";
    default:
      return reason.replace(/_/g, " ");
  }
}

async function responsePayload(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({}));
}

export default function CheckoutClient() {
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const [cart, setCart] = useState<CanonicalCart | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(EMPTY_ADDRESS);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [quoting, setQuoting] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [enablingBuyer, setEnablingBuyer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const loadAddresses = useCallback(async (): Promise<Address[]> => {
    const response = await fetch("/api/buyer/addresses", { cache: "no-store" });
    const payload = await responsePayload(response);
    if (!response.ok) {
      throw new Error(typeof payload.error === "string" ? payload.error : "Unable to load addresses");
    }
    const rows = Array.isArray(payload.addresses) ? (payload.addresses as Address[]) : [];
    setAddresses(rows);
    setSelectedAddressId((current) => {
      if (current && rows.some((address) => address.id === current)) return current;
      return rows.find((address) => address.is_default)?.id || rows[0]?.id || null;
    });
    return rows;
  }, []);

  const loadBuyerCheckout = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    setError(null);
    try {
      if (!user || !user.isBuyer) {
        setCart(null);
        setAddresses([]);
        setQuote(null);
        return;
      }

      const [{ cart: loadedCart, importResult }] = await Promise.all([
        loadCanonicalCartWithGuestImport(),
        loadAddresses(),
      ]);
      setCart(loadedCart);
      setQuote(null);
      if (importResult?.rejected.length) {
        setNotice(
          `${importResult.rejected.length} guest cart item${importResult.rejected.length === 1 ? " was" : "s were"} rejected during secure sync because the live catalogue changed.`,
        );
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to prepare checkout");
    } finally {
      setLoading(false);
    }
  }, [authLoading, loadAddresses, user]);

  useEffect(() => {
    void loadBuyerCheckout();
  }, [loadBuyerCheckout]);

  useEffect(() => {
    if (!quote || quote.status !== "ready") return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [quote]);

  const requiresShipping = Boolean(cart?.items.some((item) => item.requiresShipping));
  const hasUnavailableItems = Boolean(cart?.hasUnavailableItems);
  const quoteExpired = Boolean(quote && Date.parse(quote.expires_at) <= now);
  const selectedAddress = addresses.find((address) => address.id === selectedAddressId) || null;

  const invalidateQuote = (message?: string) => {
    setQuote(null);
    if (message) setNotice(message);
  };

  const enableBuyer = async () => {
    setEnablingBuyer(true);
    setError(null);
    try {
      await activateBuyerCapability();
      await refreshProfile();
      setNotice("Buyer capability enabled. Your existing account capabilities remain unchanged.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to enable Buyer capability");
    } finally {
      setEnablingBuyer(false);
    }
  };

  const saveAddress = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingAddress(true);
    setError(null);
    try {
      const response = await fetch("/api/buyer/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: addressDraft.nickname || null,
          isDefault: addresses.length === 0,
          type: "shipping",
          firstName: addressDraft.firstName,
          lastName: addressDraft.lastName,
          company: addressDraft.company || null,
          addressLine1: addressDraft.addressLine1,
          addressLine2: addressDraft.addressLine2 || null,
          city: addressDraft.city,
          stateProvince: addressDraft.stateProvince || null,
          postalCode: addressDraft.postalCode,
          country: addressDraft.country.toUpperCase(),
          phone: addressDraft.phone || null,
        }),
      });
      const payload = await responsePayload(response);
      if (!response.ok || typeof payload.addressId !== "string") {
        throw new Error(typeof payload.error === "string" ? payload.error : "Unable to save address");
      }
      await loadAddresses();
      setSelectedAddressId(payload.addressId);
      setAddressDraft(EMPTY_ADDRESS);
      setShowAddressForm(false);
      invalidateQuote("Address saved. Request a fresh secure quote when you are ready.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save address");
    } finally {
      setSavingAddress(false);
    }
  };

  const createQuote = async () => {
    if (!cart) return;
    setQuoting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/cart/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addressId: selectedAddressId }),
      });
      const payload = await responsePayload(response);
      if (!response.ok || !payload.quote) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Unable to create secure quote");
      }
      const trustedQuote = payload.quote as CartQuote;
      setQuote(trustedQuote);
      setNow(Date.now());
    } catch (caught) {
      setQuote(null);
      setError(caught instanceof Error ? caught.message : "Unable to create secure quote");
    } finally {
      setQuoting(false);
    }
  };

  const quoteLines = useMemo(() => {
    if (!quote) return [];
    return [
      ["Cart subtotal", quote.subtotal_cents],
      ["Shipping", quote.shipping_cents],
      ["Tax", quote.tax_cents],
      ["Discount", -quote.discount_cents],
    ] as Array<[string, number]>;
  }, [quote]);

  if (authLoading || loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-5xl items-center justify-center px-4 py-12">
        <div role="status" className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-brand-secondary" />
          <p>Preparing secure checkout…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-3xl font-bold">Secure checkout requires sign-in</h1>
        <p className="mt-4 text-foreground/70">
          Your guest cart can be imported after sign-in. EntizNetStore does not accept anonymous browser prices or addresses for payment.
        </p>
        <Link href="/auth?mode=signin&role=buyer&next=/checkout" className="luxury-button mt-8 inline-flex min-h-11 items-center justify-center">
          Sign in as Buyer
        </Link>
        <div className="mt-4"><Link href="/cart" className="text-sm underline">Return to cart</Link></div>
      </div>
    );
  }

  if (!user.isBuyer) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-3xl font-bold">Enable Buyer capability to checkout</h1>
        <p className="mt-4 text-foreground/70">
          This is additive. Your Seller or BSM capabilities stay active while the same EntizNetStore account gains permission to shop.
        </p>
        {error && <div role="alert" className="mt-5 rounded-lg border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
        <button type="button" onClick={() => void enableBuyer()} disabled={enablingBuyer} className="luxury-button mt-8 min-h-11 disabled:opacity-50">
          {enablingBuyer ? "Enabling…" : "Enable Buyer capability"}
        </button>
        <div className="mt-4"><Link href="/cart" className="text-sm underline">Return to cart</Link></div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-3xl font-bold"><T k="checkout.emptyCart" fallback="Your cart is empty" /></h1>
        <p className="mt-4 text-foreground/70"><T k="checkout.emptyDescription" fallback="Add items to your cart before checking out." /></p>
        <Link href="/store" className="luxury-button mt-8 inline-flex min-h-11 items-center justify-center"><T k="checkout.continueShopping" fallback="Continue Shopping" /></Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold"><T k="checkout.title" fallback="Checkout" /></h1>
          <p className="mt-2 text-sm text-foreground/70">Secure checkout settles in USD from a server-created cart snapshot.</p>
        </div>
        <Link href="/cart" className="min-h-11 py-3 text-sm underline">← Review cart</Link>
      </div>

      {error && <div role="alert" className="mb-5 rounded-lg border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
      {notice && <div role="status" className="mb-5 rounded-lg border border-amber-400/40 bg-amber-500/10 p-4 text-sm">{notice}</div>}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]">
        <div className="space-y-6">
          <section className="rounded-xl border border-white/10 p-5 sm:p-6" aria-labelledby="checkout-items-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="checkout-items-title" className="text-xl font-semibold">Order items</h2>
              <span className="text-sm text-foreground/60">Cart version {cart.version}</span>
            </div>
            <div className="mt-5 space-y-4">
              {cart.items.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 border-t border-white/10 pt-4 first:border-0 first:pt-0 sm:flex-row sm:items-center">
                  {item.image && (
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-white/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.image} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium"><I18nText text={item.title} /></h3>
                    {item.variantTitle && <p className="text-xs text-foreground/60">{item.variantTitle}</p>}
                    <p className="mt-1 text-sm text-foreground/70">{item.quantity} × {usd(item.unitPriceCents)}</p>
                    {!item.available && <p className="mt-1 text-sm text-amber-400">This item changed and must be reviewed in your cart.</p>}
                  </div>
                  <div className="font-semibold sm:text-right">{usd(item.lineTotalCents)}</div>
                </div>
              ))}
            </div>
          </section>

          {requiresShipping && (
            <section className="rounded-xl border border-white/10 p-5 sm:p-6" aria-labelledby="shipping-address-title">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="shipping-address-title" className="text-xl font-semibold">Shipping address</h2>
                <button type="button" onClick={() => setShowAddressForm((value) => !value)} className="min-h-11 text-sm underline">
                  {showAddressForm ? "Cancel" : "Add address"}
                </button>
              </div>

              {addresses.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {addresses.filter((address) => address.type !== "billing").map((address) => (
                    <label key={address.id} className={`cursor-pointer rounded-lg border p-4 ${selectedAddressId === address.id ? "border-brand-secondary bg-brand-secondary/10" : "border-white/10"}`}>
                      <div className="flex gap-3">
                        <input
                          type="radio"
                          name="shipping-address"
                          value={address.id}
                          checked={selectedAddressId === address.id}
                          onChange={() => {
                            setSelectedAddressId(address.id);
                            invalidateQuote("Shipping address changed. Request a fresh secure quote.");
                          }}
                          className="mt-1 h-5 w-5"
                        />
                        <span className="text-sm leading-6">
                          <strong className="block">{address.nickname || `${address.first_name} ${address.last_name}`}</strong>
                          {address.address_line1}{address.address_line2 ? `, ${address.address_line2}` : ""}<br />
                          {address.city}{address.state_province ? `, ${address.state_province}` : ""} {address.postal_code}<br />
                          {address.country}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-foreground/70">No shipping address saved yet.</p>
              )}

              {(showAddressForm || addresses.length === 0) && (
                <form onSubmit={saveAddress} className="mt-5 grid gap-3 sm:grid-cols-2">
                  <input aria-label="Address nickname" placeholder="Nickname (optional)" value={addressDraft.nickname} onChange={(event) => setAddressDraft({ ...addressDraft, nickname: event.target.value })} className="luxury-input sm:col-span-2" />
                  <input required aria-label="First name" placeholder="First name" value={addressDraft.firstName} onChange={(event) => setAddressDraft({ ...addressDraft, firstName: event.target.value })} className="luxury-input" />
                  <input required aria-label="Last name" placeholder="Last name" value={addressDraft.lastName} onChange={(event) => setAddressDraft({ ...addressDraft, lastName: event.target.value })} className="luxury-input" />
                  <input aria-label="Company" placeholder="Company (optional)" value={addressDraft.company} onChange={(event) => setAddressDraft({ ...addressDraft, company: event.target.value })} className="luxury-input sm:col-span-2" />
                  <input required aria-label="Address line 1" placeholder="Address line 1" value={addressDraft.addressLine1} onChange={(event) => setAddressDraft({ ...addressDraft, addressLine1: event.target.value })} className="luxury-input sm:col-span-2" />
                  <input aria-label="Address line 2" placeholder="Address line 2 (optional)" value={addressDraft.addressLine2} onChange={(event) => setAddressDraft({ ...addressDraft, addressLine2: event.target.value })} className="luxury-input sm:col-span-2" />
                  <input required aria-label="City" placeholder="City" value={addressDraft.city} onChange={(event) => setAddressDraft({ ...addressDraft, city: event.target.value })} className="luxury-input" />
                  <input aria-label="State or province" placeholder="State / province" value={addressDraft.stateProvince} onChange={(event) => setAddressDraft({ ...addressDraft, stateProvince: event.target.value })} className="luxury-input" />
                  <input required aria-label="Postal code" placeholder="Postal code" value={addressDraft.postalCode} onChange={(event) => setAddressDraft({ ...addressDraft, postalCode: event.target.value })} className="luxury-input" />
                  <input required minLength={2} maxLength={2} aria-label="Country code" placeholder="Country code" value={addressDraft.country} onChange={(event) => setAddressDraft({ ...addressDraft, country: event.target.value.toUpperCase() })} className="luxury-input" />
                  <input aria-label="Phone" placeholder="Phone (optional)" value={addressDraft.phone} onChange={(event) => setAddressDraft({ ...addressDraft, phone: event.target.value })} className="luxury-input sm:col-span-2" />
                  <button type="submit" disabled={savingAddress} className="luxury-button min-h-11 sm:col-span-2 disabled:opacity-50">{savingAddress ? "Saving…" : "Save shipping address"}</button>
                </form>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-5">
          <section className="rounded-xl border border-white/10 p-5 sm:p-6">
            <h2 className="text-xl font-semibold">Secure totals</h2>
            <p className="mt-2 text-sm text-foreground/70">
              A quote revalidates live Seller status, catalogue state, price, inventory, shipping and tax before checkout.
            </p>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4"><span>Current cart subtotal</span><strong>{usd(cart.subtotalCents)}</strong></div>
              {selectedAddress && requiresShipping && <p className="text-xs text-foreground/60">Ship to {selectedAddress.city}, {selectedAddress.country}</p>}
            </div>

            {hasUnavailableItems ? (
              <div className="mt-5 rounded-lg border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-200">
                Cart availability changed. <Link href="/cart" className="underline">Review the cart</Link> before requesting a quote.
              </div>
            ) : requiresShipping && !selectedAddressId ? (
              <div className="mt-5 rounded-lg border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-200">Add or choose a shipping address first.</div>
            ) : (
              <button type="button" onClick={() => void createQuote()} disabled={quoting} className="luxury-button mt-5 min-h-11 w-full disabled:opacity-50">
                {quoting ? "Revalidating…" : quote ? "Refresh secure quote" : "Review secure totals"}
              </button>
            )}
          </section>

          {quote && (
            <section className="rounded-xl border border-white/10 p-5 sm:p-6" aria-labelledby="trusted-quote-title">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="trusted-quote-title" className="text-xl font-semibold">Trusted server quote</h2>
                  <p className="mt-1 text-xs text-foreground/60">Expires {new Date(quote.expires_at).toLocaleString()}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${quote.status === "ready" && !quoteExpired ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
                  {quoteExpired ? "expired" : quote.status}
                </span>
              </div>

              <div className="mt-5 space-y-3 text-sm">
                {quoteLines.map(([label, cents]) => (
                  <div key={label} className="flex justify-between gap-4"><span className="text-foreground/70">{label}</span><span>{usd(cents)}</span></div>
                ))}
                <div className="flex justify-between gap-4 border-t border-white/10 pt-3 text-lg font-bold"><span>Total</span><span>{usd(quote.total_cents)}</span></div>
              </div>

              {quote.status === "blocked" && (
                <div className="mt-5 space-y-2">
                  {quote.block_reasons.map((reason) => (
                    <div key={reason} className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-200">{blockerMessage(reason)}</div>
                  ))}
                </div>
              )}

              {quoteExpired && (
                <button type="button" onClick={() => { setQuote(null); setNotice("Quote expired. Request a fresh secure quote before payment."); }} className="mt-5 min-h-11 w-full rounded-lg border border-white/20 px-4 py-3 font-medium">Create fresh quote</button>
              )}

              {quote.status === "ready" && !quoteExpired && (
                <div className="mt-5 border-t border-white/10 pt-5">
                  <CartPayment
                    cartId={cart.id}
                    quoteId={quote.id}
                    onNeedsRequote={() => invalidateQuote("Checkout changed or expired. Request a fresh secure quote before trying again.")}
                  />
                </div>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
