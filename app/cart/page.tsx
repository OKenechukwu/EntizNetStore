"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useBrand } from "@/components/BrandProvider";
import { useAuth } from "@/components/AuthProvider";
import Price from "@/components/common/Price";
import I18nText from "@/components/i18n/I18nText";
import { T } from "@/components/i18n/I18nProvider";
import {
  clearCart as clearGuestCart,
  getCart as getGuestCart,
  removeItem as removeGuestItem,
  setQty as setGuestQty,
  type CartItem as GuestCartItem,
} from "@/lib/cart";
import {
  activateBuyerCapability,
  clearCanonicalCart,
  guestCartSubtotal,
  loadCanonicalCartWithGuestImport,
  removeCanonicalCartItem,
  setCanonicalCartItem,
} from "@/lib/cart/client";
import type { CanonicalCart, CanonicalCartItem } from "@/lib/cart/contracts";

function availabilityMessage(reason: string | null): string {
  switch (reason) {
    case "catalogue_item_missing":
      return "This catalogue item is no longer available.";
    case "product_unavailable":
      return "This product is currently unavailable.";
    case "seller_unavailable":
      return "This Seller is not currently available for checkout.";
    case "variant_unavailable":
      return "This selected variant is currently unavailable.";
    case "insufficient_inventory":
      return "The requested quantity is no longer available.";
    default:
      return "This item needs review before checkout.";
  }
}

export default function CartPage() {
  const { theme, brand } = useBrand();
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const [guestCart, setGuestCart] = useState<GuestCartItem[]>([]);
  const [canonicalCart, setCanonicalCart] = useState<CanonicalCart | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadCart = useCallback(async () => {
    if (authLoading) return;

    setLoading(true);
    setError(null);
    try {
      if (!user) {
        setCanonicalCart(null);
        setGuestCart(getGuestCart());
        return;
      }

      if (!user.isBuyer) {
        setCanonicalCart(null);
        setGuestCart(getGuestCart());
        return;
      }

      const { cart, importResult } = await loadCanonicalCartWithGuestImport();
      setGuestCart([]);
      setCanonicalCart(cart);
      if (importResult?.rejected.length) {
        setNotice(
          `${importResult.rejected.length} guest cart item${importResult.rejected.length === 1 ? " was" : "s were"} not imported because the current catalogue no longer allows checkout.`,
        );
      } else if (importResult && importResult.imported > 0) {
        setNotice(
          `${importResult.imported} guest cart item${importResult.imported === 1 ? "" : "s"} synced to your account.`,
        );
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load cart");
    } finally {
      setLoading(false);
    }
  }, [authLoading, user]);

  useEffect(() => {
    void loadCart();
    const reload = () => void loadCart();
    window.addEventListener("storage", reload);
    window.addEventListener("cartUpdate", reload);
    return () => {
      window.removeEventListener("storage", reload);
      window.removeEventListener("cartUpdate", reload);
    };
  }, [loadCart]);

  const displayedItems = useMemo(() => {
    if (user?.isBuyer) return canonicalCart?.items || [];
    return guestCart;
  }, [canonicalCart, guestCart, user?.isBuyer]);

  const itemCount = user?.isBuyer
    ? canonicalCart?.itemCount || 0
    : guestCart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = user?.isBuyer
    ? (canonicalCart?.subtotalCents || 0) / 100
    : guestCartSubtotal(guestCart);
  const hasUnavailableItems = Boolean(user?.isBuyer && canonicalCart?.hasUnavailableItems);

  const handleCanonicalQuantity = async (item: CanonicalCartItem, quantity: number) => {
    if (quantity < 1) return;
    setBusyKey(item.id);
    setError(null);
    try {
      setCanonicalCart(
        await setCanonicalCartItem({
          productId: item.productId,
          variantId: item.variantId,
          quantity,
        }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update cart");
    } finally {
      setBusyKey(null);
    }
  };

  const handleGuestQuantity = (item: GuestCartItem, quantity: number) => {
    if (quantity < 1) return;
    setGuestQty(item.id, quantity, item.variantId);
    setGuestCart(getGuestCart());
  };

  const handleRemove = async (item: CanonicalCartItem | GuestCartItem) => {
    if (user?.isBuyer && "productId" in item) {
      setBusyKey(item.id);
      setError(null);
      try {
        setCanonicalCart(await removeCanonicalCartItem(item.id));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to remove cart item");
      } finally {
        setBusyKey(null);
      }
      return;
    }

    const guest = item as GuestCartItem;
    removeGuestItem(guest.id, guest.variantId);
    setGuestCart(getGuestCart());
  };

  const handleClear = async () => {
    setBusyKey("clear");
    setError(null);
    try {
      if (user?.isBuyer) {
        setCanonicalCart(await clearCanonicalCart());
      } else {
        clearGuestCart();
        setGuestCart([]);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to clear cart");
    } finally {
      setBusyKey(null);
    }
  };

  const handleEnableBuyer = async () => {
    setBusyKey("buyer-capability");
    setError(null);
    try {
      await activateBuyerCapability();
      await refreshProfile();
      setNotice("Buyer capability enabled. Your cart can now sync securely to your account.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to enable Buyer capability");
    } finally {
      setBusyKey(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: theme.colors.background }}>
        <div className="text-center">
          <div
            className="animate-spin w-8 h-8 border-2 rounded-full mb-4 mx-auto"
            style={{ borderColor: theme.colors.glass.border, borderTopColor: theme.colors.accent }}
          />
          <p style={{ color: theme.colors.text.secondary }}><T k="cart.loadingCart" /></p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.colors.background }}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold" style={{ color: theme.colors.text.primary }}>
              <T k="cart.title" />
            </h1>
            <p className="mt-2 text-sm" style={{ color: theme.colors.text.secondary }}>
              {user?.isBuyer
                ? "Your signed-in cart is stored securely with your account."
                : "Guest cart prices are for browsing only. Final availability and totals are verified after sign-in."}
            </p>
          </div>
          <Link href="/store" className="text-sm hover:opacity-70" style={{ color: theme.colors.accent }}>
            ← <T k="cart.continueShopping" />
          </Link>
        </div>

        {error && (
          <div role="alert" className="mb-5 rounded-lg border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="mb-5 rounded-lg border border-amber-400/40 bg-amber-500/10 p-4 text-sm">
            {notice}
          </div>
        )}

        {user && !user.isBuyer && (
          <div className="mb-6 rounded-xl border p-5" style={{ borderColor: theme.colors.glass.border }}>
            <h2 className="font-semibold">Buyer capability required for checkout</h2>
            <p className="mt-2 text-sm" style={{ color: theme.colors.text.secondary }}>
              Your existing account can also shop as a Buyer. Enabling this capability does not remove or replace your Seller or BSM capabilities.
            </p>
            <button
              type="button"
              onClick={handleEnableBuyer}
              disabled={busyKey === "buyer-capability"}
              className="luxury-button mt-4 min-h-11 disabled:opacity-50"
            >
              {busyKey === "buyer-capability" ? "Enabling…" : "Enable Buyer capability"}
            </button>
          </div>
        )}

        {displayedItems.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-6" aria-hidden="true">🛒</div>
            <h2 className="text-2xl font-bold mb-4"><T k="cart.empty" /></h2>
            <p className="text-lg mb-8 max-w-md mx-auto" style={{ color: theme.colors.text.secondary }}>
              <T k={brand === "primediscreet" ? "cart.emptyDescriptionPrimediscreet" : "cart.emptyDescriptionEntiznet"} />
            </p>
            <Link href="/store" className="luxury-button inline-flex min-h-11 items-center justify-center">
              <T k="cart.startShopping" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              {displayedItems.map((rawItem) => {
                const isCanonical = "productId" in rawItem;
                const item = rawItem as CanonicalCartItem | GuestCartItem;
                const quantity = isCanonical ? (item as CanonicalCartItem).quantity : (item as GuestCartItem).qty;
                const unitPrice = isCanonical ? (item as CanonicalCartItem).unitPriceCents / 100 : (item as GuestCartItem).priceBase;
                const linePrice = isCanonical ? (item as CanonicalCartItem).lineTotalCents / 100 : unitPrice * quantity;
                const image = isCanonical ? (item as CanonicalCartItem).image : (item as GuestCartItem).image;
                const variantTitle = isCanonical ? (item as CanonicalCartItem).variantTitle : (item as GuestCartItem).variantTitle;
                const unavailable = isCanonical && !(item as CanonicalCartItem).available;

                return (
                  <div key={`${item.id}:${isCanonical ? (item as CanonicalCartItem).variantId : (item as GuestCartItem).variantId || "default"}`} className="rounded-lg border p-4 sm:p-6" style={{ borderColor: theme.colors.glass.border }}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div className="h-20 w-20 overflow-hidden rounded-lg flex-shrink-0" style={{ backgroundColor: theme.colors.surface }}>
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={image} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-2xl" aria-hidden="true">📦</div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-semibold"><I18nText text={item.title} /></h3>
                        {variantTitle && <p className="mt-1 text-xs" style={{ color: theme.colors.text.secondary }}>{variantTitle}</p>}
                        <p className="mt-1 text-sm" style={{ color: theme.colors.text.secondary }}>
                          <Price amount={unitPrice} /> <T k="cart.each" />
                        </p>
                        {unavailable && (
                          <p className="mt-2 text-sm text-amber-400">
                            {availabilityMessage((item as CanonicalCartItem).availabilityReason)}
                          </p>
                        )}

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <span className="text-sm font-medium" style={{ color: theme.colors.text.secondary }}><T k="cart.quantity" /></span>
                          <div className="flex items-center rounded-lg border" style={{ borderColor: theme.colors.glass.border }}>
                            <button
                              type="button"
                              aria-label={`Decrease quantity for ${item.title}`}
                              onClick={() => isCanonical
                                ? void handleCanonicalQuantity(item as CanonicalCartItem, quantity - 1)
                                : handleGuestQuantity(item as GuestCartItem, quantity - 1)}
                              disabled={quantity <= 1 || busyKey === item.id}
                              className="min-h-11 min-w-11 disabled:opacity-40"
                            >−</button>
                            <span className="w-10 text-center font-medium">{quantity}</span>
                            <button
                              type="button"
                              aria-label={`Increase quantity for ${item.title}`}
                              onClick={() => isCanonical
                                ? void handleCanonicalQuantity(item as CanonicalCartItem, quantity + 1)
                                : handleGuestQuantity(item as GuestCartItem, quantity + 1)}
                              disabled={busyKey === item.id}
                              className="min-h-11 min-w-11 disabled:opacity-40"
                            >+</button>
                          </div>
                        </div>
                      </div>

                      <div className="sm:text-right">
                        <p className="text-lg font-bold" style={{ color: theme.colors.accent }}><Price amount={linePrice} /></p>
                        <button
                          type="button"
                          onClick={() => void handleRemove(item)}
                          disabled={busyKey === item.id}
                          className="mt-2 min-h-11 text-sm text-red-400 hover:opacity-70 disabled:opacity-40"
                        >
                          <T k="cart.remove" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="text-right pt-2">
                <button
                  type="button"
                  onClick={() => void handleClear()}
                  disabled={busyKey === "clear"}
                  className="min-h-11 text-sm hover:opacity-70 disabled:opacity-40"
                  style={{ color: theme.colors.text.secondary }}
                >
                  {busyKey === "clear" ? "Clearing…" : <T k="cart.clearAll" />}
                </button>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-24 rounded-lg border p-6" style={{ borderColor: theme.colors.glass.border }}>
                <h3 className="text-xl font-bold mb-6"><T k="cart.orderSummary" /></h3>
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between gap-4 text-sm">
                    <span style={{ color: theme.colors.text.secondary }}><T k="cart.items" /> ({itemCount})</span>
                    <span><Price amount={subtotal} /></span>
                  </div>
                  <div className="flex justify-between gap-4 text-sm">
                    <span style={{ color: theme.colors.text.secondary }}>Shipping & tax</span>
                    <span className="text-right" style={{ color: theme.colors.text.secondary }}>Calculated from a secure checkout quote</span>
                  </div>
                  <div className="border-t pt-4" style={{ borderColor: theme.colors.glass.border }}>
                    <div className="flex justify-between gap-4 text-lg font-bold">
                      <span>Cart subtotal</span>
                      <span style={{ color: theme.colors.accent }}><Price amount={subtotal} /></span>
                    </div>
                  </div>
                </div>

                {!user ? (
                  <Link
                    href="/auth?mode=signin&role=buyer&next=/checkout"
                    className="luxury-button flex min-h-11 w-full items-center justify-center text-center"
                  >
                    Sign in to checkout
                  </Link>
                ) : !user.isBuyer ? (
                  <button
                    type="button"
                    onClick={handleEnableBuyer}
                    disabled={busyKey === "buyer-capability"}
                    className="luxury-button min-h-11 w-full disabled:opacity-50"
                  >
                    Enable Buyer capability to checkout
                  </button>
                ) : hasUnavailableItems ? (
                  <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-200">
                    Resolve unavailable cart items before checkout.
                  </div>
                ) : (
                  <Link
                    href="/checkout"
                    className="luxury-button flex min-h-11 w-full items-center justify-center text-center"
                  >
                    <T k="cart.proceedToCheckout" />
                  </Link>
                )}

                <div className="mt-5 space-y-2 text-xs" style={{ color: theme.colors.text.secondary }}>
                  <p>🔒 Checkout totals are recalculated from the live catalogue on the server.</p>
                  <p>🚚 Shipping and tax are not claimed until trusted quote providers return them.</p>
                  <p>↩️ Returns follow the Seller policy shown for each product/store.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
