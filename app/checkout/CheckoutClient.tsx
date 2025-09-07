"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { getFxRates, convertFromBase, DEFAULT_CURRENCY } from "@/lib/currency";
import { 
  getCart, 
  setQty, 
  removeItem, 
  clearCart, 
  subtotalBase,
  type CartItem 
} from "@/lib/cart";

export default function CheckoutClient() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [userCurrency, setUserCurrency] = useState(DEFAULT_CURRENCY);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  // Load cart and currency on mount
  useEffect(() => {
    setCart(getCart());
    
    // Read currency from cookie
    const cookieValue = document.cookie
      .split("; ")
      .find(row => row.startsWith("currency="))
      ?.split("=")[1];
    
    if (cookieValue) {
      setUserCurrency(cookieValue.toUpperCase());
    }
  }, []);

  // Fetch FX rates when currency changes
  useEffect(() => {
    async function fetchRates() {
      try {
        const response = await fetch("/api/fx");
        if (response.ok) {
          const data = await response.json();
          setRates(data.rates || {});
        }
      } catch (error) {
        console.error("Failed to fetch FX rates:", error);
      }
    }

    fetchRates();
  }, [userCurrency]);

  const handleQtyChange = (id: string, newQty: number) => {
    if (newQty < 1) return;
    setQty(id, newQty);
    setCart(getCart());
  };

  const handleRemoveItem = (id: string) => {
    removeItem(id);
    setCart(getCart());
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;

    setIsLoading(true);
    
    try {
      const orderPayload = {
        items: cart.map(item => ({
          id: item.id,
          qty: item.qty
        })),
        subtotalBase: subtotalBase()
      };

      const response = await fetch("/api/store/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderPayload),
      });

      if (response.ok) {
        clearCart();
        setCart([]);
        setOrderSuccess(true);
        setTimeout(() => setOrderSuccess(false), 5000);
      } else {
        throw new Error("Failed to place order");
      }
    } catch (error) {
      console.error("Order failed:", error);
      alert("Failed to place order. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const convertPrice = (priceBase: number): number => {
    return convertFromBase(priceBase, userCurrency, rates);
  };

  const totalBase = subtotalBase();
  const totalConverted = convertPrice(totalBase);

  if (cart.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center">
        <h1 className="text-2xl font-semibold mb-4">Your Cart is Empty</h1>
        <p className="text-gray-600 mb-6">
          Browse our store to find products you'd like to purchase.
        </p>
        <Link
          href="/store"
          className="inline-block px-6 py-3 bg-black text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/store" className="text-sm underline hover:opacity-80">
          ← Continue Shopping
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-8">Checkout</h1>

      {orderSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 font-medium">
            ✓ Order placed successfully! Thank you for your purchase.
          </p>
        </div>
      )}

      <div className="space-y-4 mb-8">
        {cart.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-4 p-4 border rounded-lg"
          >
            {item.image && (
              <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            <div className="flex-1">
              <h3 className="font-medium">{item.title}</h3>
              <p className="text-sm text-gray-600">
                {formatPrice(convertPrice(item.priceBase), userCurrency)} each
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleQtyChange(item.id, item.qty - 1)}
                disabled={item.qty <= 1}
                className="w-8 h-8 rounded border flex items-center justify-center hover:bg-gray-50 disabled:opacity-50"
              >
                −
              </button>
              <span className="w-8 text-center">{item.qty}</span>
              <button
                onClick={() => handleQtyChange(item.id, item.qty + 1)}
                className="w-8 h-8 rounded border flex items-center justify-center hover:bg-gray-50"
              >
                +
              </button>
            </div>

            <div className="text-right">
              <p className="font-medium">
                {formatPrice(convertPrice(item.priceBase * item.qty), userCurrency)}
              </p>
              <button
                onClick={() => handleRemoveItem(item.id)}
                className="text-sm text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-6">
        <div className="flex justify-between items-center mb-6">
          <span className="text-lg font-semibold">Total:</span>
          <span className="text-2xl font-bold">
            {formatPrice(totalConverted, userCurrency)}
          </span>
        </div>

        <button
          onClick={handlePlaceOrder}
          disabled={isLoading || cart.length === 0}
          className="w-full py-3 bg-black text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isLoading ? "Placing Order..." : "Place Order"}
        </button>
      </div>
    </div>
  );
}