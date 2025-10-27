// components/product/ProductInfoPanelClient.tsx
"use client";

import { useRouter } from "next/navigation";
import ProductInfoPanel from "./ProductInfoPanel";
import { addItem } from "@/lib/cart";
import type { Product } from "@/types/product";

type Props = {
  product: Product;
};

export default function ProductInfoPanelClient({ product }: Props) {
  const router = useRouter();

  const handleAddToCart = (quantity: number, variantId?: string) => {
    try {
      addItem({
        id: product.id,
        title: product.title,
        priceBase: product.basePrice,
        qty: quantity,
      });
      
      // TODO: Show toast notification
      alert(`Added ${quantity} item(s) to cart`);
    } catch (error) {
      console.error("Failed to add to cart:", error);
      alert("Failed to add to cart. Please try again.");
    }
  };

  const handleBuyNow = (quantity: number, variantId?: string) => {
    try {
      addItem({
        id: product.id,
        title: product.title,
        priceBase: product.basePrice,
        qty: quantity,
      });
      
      // Navigate to checkout
      router.push("/cart");
    } catch (error) {
      console.error("Failed to proceed to checkout:", error);
      alert("Failed to proceed to checkout. Please try again.");
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
