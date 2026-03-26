"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { countItems } from "@/lib/cart";

export default function CartLink() {
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    setItemCount(countItems());

    const updateCount = () => setItemCount(countItems());
    
    window.addEventListener("storage", updateCount);
    window.addEventListener("cartUpdate", updateCount);

    return () => {
      window.removeEventListener("storage", updateCount);
      window.removeEventListener("cartUpdate", updateCount);
    };
  }, []);

  return (
    <Link 
      href="/checkout" 
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