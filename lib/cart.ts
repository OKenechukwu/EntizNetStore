// lib/cart.ts
"use client";

export type CartItem = {
  id: string;
  variantId?: string;
  variantTitle?: string;
  title: string;
  priceBase: number; // always USD
  image?: string;
  qty: number;
};

const CART_KEY = "cart:v1";

// Guard for SSR
function isClient(): boolean {
  return typeof window !== "undefined";
}

export function getCart(): CartItem[] {
  if (!isClient()) return [];
  
  try {
    const stored = localStorage.getItem(CART_KEY);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setCart(items: CartItem[]): void {
  if (!isClient()) return;
  
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("cartUpdate", { detail: { items } }));
  } catch {
    // Silent fail in case localStorage is not available
  }
}

export function addItem(item: CartItem): void {
  const cart = getCart();
  const existingIndex = cart.findIndex(
    (cartItem) =>
      cartItem.id === item.id && cartItem.variantId === item.variantId,
  );
  
  if (existingIndex >= 0) {
    // Item exists, increase quantity
    cart[existingIndex].qty += item.qty;
  } else {
    // New item
    cart.push(item);
  }
  
  setCart(cart);
}

export function removeItem(id: string, variantId?: string): void {
  const cart = getCart();
  const filtered = cart.filter(
    (item) => item.id !== id || item.variantId !== variantId,
  );
  setCart(filtered);
}

export function setQty(id: string, qty: number, variantId?: string): void {
  // Clamp qty to minimum of 1
  const clampedQty = Math.max(1, qty);
  
  const cart = getCart();
  const item = cart.find(
    (cartItem) => cartItem.id === id && cartItem.variantId === variantId,
  );
  
  if (item) {
    item.qty = clampedQty;
    setCart(cart);
  }
}

export function clearCart(): void {
  if (!isClient()) return;
  
  try {
    localStorage.removeItem(CART_KEY);
    window.dispatchEvent(new CustomEvent("cartUpdate", { detail: { items: [] } }));
  } catch {
    // Silent fail
  }
}

export function countItems(): number {
  const cart = getCart();
  return cart.reduce((total, item) => total + item.qty, 0);
}

export function subtotalBase(): number {
  const cart = getCart();
  return cart.reduce((total, item) => total + (item.priceBase * item.qty), 0);
}
