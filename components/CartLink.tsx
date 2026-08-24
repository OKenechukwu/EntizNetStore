"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { clearCart, countItems, getCart } from "@/lib/cart";
import { useAuth } from "@/components/AuthProvider";

export default function CartLink() {
  const { user, loading } = useAuth();
  const [itemCount, setItemCount] = useState(0);

  const loadCount = useCallback(async () => {
    if (loading) return;

    if (!user) {
      setItemCount(countItems());
      return;
    }

    if (!user.isBuyer) {
      setItemCount(0);
      return;
    }

    try {
      const legacy = getCart();
      if (legacy.length > 0) {
        const importResponse = await fetch("/api/cart/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: legacy.map((item) => ({
              productId: item.id,
              variantId: item.variantId || null,
              quantity: item.qty,
            })),
          }),
        });

        if (importResponse.ok) {
          const imported = await importResponse.json();
          setItemCount(Number(imported.cart?.itemCount || 0));
          clearCart();
          return;
        }
      }

      const response = await fetch("/api/cart", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load cart");
      const payload = await response.json();
      setItemCount(Number(payload.cart?.itemCount || 0));
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
      className="relative text-sky-600 hover:underline flex items-center gap-1"
    >
      Cart
      {itemCount > 0 && (
        <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      )}
    </Link>
  );
}
