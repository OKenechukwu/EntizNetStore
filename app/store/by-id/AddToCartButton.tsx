"use client";

import { useState } from "react";
import { addItem } from "@/lib/cart";

type Props = {
  product: {
    id: string;
    title: string;
    price: number | null;
    images?: string[];
  };
};

export default function AddToCartButton({ product }: Props) {
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    addItem({
      id: product.id,
      title: product.title,
      priceBase: Number(product.price ?? 0),
      image: product.images?.[0],
      qty: 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <button
      onClick={handleAdd}
      className="bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
    >
      {added ? "Added to cart" : "Add to cart"}
    </button>
  );
}
