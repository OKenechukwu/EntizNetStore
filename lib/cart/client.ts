"use client";

import {
  clearCart as clearGuestCart,
  getCart as getGuestCart,
  type CartItem as GuestCartItem,
} from "@/lib/cart";
import type { CanonicalCart, GuestCartImportResult } from "@/lib/cart/contracts";

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({}));
}

function responseError(payload: Record<string, unknown>, fallback: string): Error {
  return new Error(typeof payload.error === "string" ? payload.error : fallback);
}

export function dispatchCartUpdate(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("cartUpdate"));
  }
}

export async function fetchCanonicalCart(): Promise<CanonicalCart | null> {
  const response = await fetch("/api/cart", { cache: "no-store" });
  const payload = await readJson(response);
  if (!response.ok) throw responseError(payload, "Unable to load cart");
  return (payload.cart as CanonicalCart | null | undefined) ?? null;
}

export async function importGuestCartIfPresent(): Promise<GuestCartImportResult | null> {
  const guest = getGuestCart();
  if (guest.length === 0) return null;

  const response = await fetch("/api/cart/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: guest.map((item) => ({
        productId: item.id,
        variantId: item.variantId || null,
        quantity: item.qty,
      })),
    }),
  });
  const payload = await readJson(response);
  if (!response.ok) throw responseError(payload, "Unable to import guest cart");

  const result: GuestCartImportResult = {
    cart: (payload.cart as CanonicalCart | null | undefined) ?? null,
    imported: Number(payload.imported || 0),
    rejected: Array.isArray(payload.rejected)
      ? (payload.rejected as GuestCartImportResult["rejected"])
      : [],
    skipped: Boolean(payload.skipped),
  };

  // The import endpoint is deliberately non-destructive when a canonical cart
  // already exists. Once the server has answered successfully, the browser cart
  // must stop competing as a second source of truth even when some stale guest
  // items were rejected. clearGuestCart already emits the single cartUpdate event.
  clearGuestCart();
  return result;
}

export async function loadCanonicalCartWithGuestImport(): Promise<{
  cart: CanonicalCart | null;
  importResult: GuestCartImportResult | null;
}> {
  const importResult = await importGuestCartIfPresent();
  if (importResult?.cart) return { cart: importResult.cart, importResult };
  return { cart: await fetchCanonicalCart(), importResult };
}

export async function setCanonicalCartItem(input: {
  productId: string;
  variantId: string;
  quantity: number;
}): Promise<CanonicalCart | null> {
  const response = await fetch("/api/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await readJson(response);
  if (!response.ok) throw responseError(payload, "Unable to update cart");
  dispatchCartUpdate();
  return (payload.cart as CanonicalCart | null | undefined) ?? null;
}

export async function setCanonicalWholesaleCartItem(input: {
  offerId: string;
  quantity: number;
}): Promise<CanonicalCart | null> {
  const response = await fetch("/api/cart/wholesale", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await readJson(response);
  if (!response.ok) throw responseError(payload, "Unable to update wholesale cart");
  dispatchCartUpdate();
  return (payload.cart as CanonicalCart | null | undefined) ?? null;
}

export async function removeCanonicalCartItem(itemId: string): Promise<CanonicalCart | null> {
  const response = await fetch("/api/cart", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId }),
  });
  const payload = await readJson(response);
  if (!response.ok) throw responseError(payload, "Unable to remove cart item");
  dispatchCartUpdate();
  return (payload.cart as CanonicalCart | null | undefined) ?? null;
}

export async function clearCanonicalCart(): Promise<CanonicalCart | null> {
  const response = await fetch("/api/cart", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clear: true }),
  });
  const payload = await readJson(response);
  if (!response.ok) throw responseError(payload, "Unable to clear cart");
  dispatchCartUpdate();
  return (payload.cart as CanonicalCart | null | undefined) ?? null;
}

export async function activateBuyerCapability(): Promise<void> {
  const response = await fetch("/api/onboarding/buyer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const payload = await readJson(response);
  if (!response.ok) throw responseError(payload, "Unable to enable Buyer capability");
}

export function guestCartSubtotal(items: GuestCartItem[]): number {
  return items.reduce((sum, item) => sum + item.priceBase * item.qty, 0);
}
