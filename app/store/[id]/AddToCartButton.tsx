"use client";

import { useState } from "react";
import { addItem } from "@/lib/cart";
import Link from "next/link";

type Product = {
  id: string;
  title: string;
  price: number | string | null;
  images?: string[];
};

export default function AddToCartButton({ product }: { product: Product }) {
  const [showSuccess, setShowSuccess] = useState(false);

  const handleAddToCart = () => {
    addItem({
      id: product.id,
      title: product.title,
      priceBase: Number(product.price ?? 0),
      image: product.images?.[0],
      qty: 1,
    });

    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <div className="pt-4">
      <button
        onClick={handleAddToCart}
        className="px-4 py-2 rounded-lg bg-black text-white hover:opacity-90 transition-opacity"
      >
        Add to Cart
      </button>
      
      {showSuccess && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800 font-medium">
            ✓ Added to cart!
          </p>
          <Link
            href="/checkout"
            className="text-sm text-green-600 hover:underline"
          >
            View cart →
          </Link>
        </div>
      )}
    </div>
  );
}