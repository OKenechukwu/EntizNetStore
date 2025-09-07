"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { countItems } from "@/lib/cart";

export default function CartLink() {
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    // Update count on mount
    setItemCount(countItems());

    // Listen for cart changes via custom events or storage events
    const updateCount = () => setItemCount(countItems());
    
    // Update when localStorage changes (from other tabs/windows)
    window.addEventListener("storage", updateCount);
    
    // Also update periodically in case cart changes from same tab
    const interval = setInterval(updateCount, 1000);

    return () => {
      window.removeEventListener("storage", updateCount);
      clearInterval(interval);
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