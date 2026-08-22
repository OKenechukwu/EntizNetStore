// components/product/ProductInfoPanelClient.tsx
"use client";

import { useRouter } from "next/navigation";
import ProductInfoPanel from "./ProductInfoPanel";
import { addItem } from "@/lib/cart";
import { useAuth } from "@/components/AuthProvider";
import type { Product } from "@/types/product";

type Props = {
  product: Product;
};

export default function ProductInfoPanelClient({ product }: Props) {
  const router = useRouter();
  const { user, loading } = useAuth();

  const persistItem = async (quantity: number, variantId?: string) => {
    const variant = product.variants?.find((item) => item.id === variantId)
      || product.variants?.[0];

    if (user) {
      if (!user.isBuyer) throw new Error("Buyer capability required");
      if (!variant?.id) throw new Error("Product variant is unavailable");

      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          variantId: variant.id,
          quantity,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to update cart");
    } else {
      // Anonymous shopping remains temporary and is imported into the trusted
      // Buyer cart after sign-in. Local prices are never checkout authority.
      addItem({
        id: product.id,
        variantId: variant?.id || variantId,
        variantTitle: variant?.name,
        title: product.title,
        priceBase: product.basePrice + (variant?.priceDeltaBase || 0),
        qty: quantity,
      });
    }

    window.dispatchEvent(new Event("cartUpdate"));
  };

  const handleAddToCart = async (quantity: number, variantId?: string) => {
    if (loading) return;
    try {
      await persistItem(quantity, variantId);
      alert(`Added ${quantity} item(s) to cart`);
    } catch (error) {
      console.error("Failed to add to cart:", error);
      alert(error instanceof Error ? error.message : "Failed to add to cart. Please try again.");
    }
  };

  const handleBuyNow = async (quantity: number, variantId?: string) => {
    if (loading) return;
    try {
      await persistItem(quantity, variantId);
      router.push("/cart");
    } catch (error) {
      console.error("Failed to proceed to checkout:", error);
      alert(error instanceof Error ? error.message : "Failed to proceed to checkout. Please try again.");
    }
  };

  return (
    <ProductInfoPanel
      product={product}
      onAddToCart={handleAddToCart}
      onBuyNow={handleBuyNow}
    />
  );
}
