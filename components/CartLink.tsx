"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { countItems } from "@/lib/cart";
import { loadCanonicalCartWithGuestImport } from "@/lib/cart/client";
import { useAuth } from "@/components/AuthProvider";

export default function CartLink() {
  const { user, loading } = useAuth();
  const [itemCount, setItemCount] = useState(0);

  const loadCount = useCallback(async () => {
    if (loading) return;

    // Anonymous users and signed-in accounts that have not enabled Buyer yet
    // still see their temporary guest-cart count. Once Buyer is active, the
    // canonical server cart becomes the only authority and any guest cart is
    // imported once through the shared non-destructive transition helper.
    if (!user || !user.isBuyer) {
      setItemCount(countItems());
      return;
    }

    try {
      const { cart } = await loadCanonicalCartWithGuestImport();
      setItemCount(Number(cart?.itemCount || 0));
    } catch (error) {
      console.error("Unable to refresh cart count", error);
    }
  }, [loading, user]);

  useEffect(() => {
    void loadCount();

    const updateCount = () => void loadCount();
    window.addEventListener("storage", updateCount);
    window.addEventListener("cartUpdate", updateCount);

    return () => {
      window.removeEventListener("storage", updateCount);
      window.removeEventListener("cartUpdate", updateCount);
    };
  }, [loadCount]);

  return (
    <Link
      href="/cart"
      className="relative flex min-h-11 items-center gap-1 rounded-md px-2 text-sky-600 hover:underline"
      aria-label={itemCount > 0 ? `Cart with ${itemCount} item${itemCount === 1 ? "" : "s"}` : "Cart"}
    >
      Cart
      {itemCount > 0 && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white" aria-hidden="true">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      )}
    </Link>
  );
}
