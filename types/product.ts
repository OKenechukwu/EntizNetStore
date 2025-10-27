// types/product.ts
/**
 * Comprehensive Product type for Lazada-style product pages
 * All prices are stored in BASE_CURRENCY (USD)
 */

export interface ProductBrand {
  id: string;
  name: string;
  slug: string;
}

export interface ProductImage {
  url: string;
  alt?: string;
}

export interface ProductVoucher {
  id: string;
  label: string;
  discountType: "amount" | "percent";
  value: number;
}

export interface ShippingOrigin {
  area?: string;
  city?: string;
  province?: string;
  state?: string;
  country?: string;
  isOverseas?: boolean;
}

export interface DeliveryOption {
  type: "standard" | "express";
  etaDaysMin: number;
  etaDaysMax: number;
  feeBase?: number; // in BASE_CURRENCY
}

export interface ReturnPolicy {
  shortLabel?: string; // e.g., "7 Days Free Return · 2 Months International Seller Warranty"
  fullText?: string;
  warrantyMonths?: number;
}

export interface ProductVariantOptions {
  color?: string[];
  pairing?: string[];
  type?: string[];
}

export interface ProductVariant {
  id: string;
  name: string; // e.g., "Upgrade+Bluetooth+GT"
  options?: ProductVariantOptions;
  priceDeltaBase?: number; // BASE_CURRENCY delta to basePrice
  stockRemaining?: number;
}

export interface ProductStore {
  id: string;
  name: string;
  slug: string;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  brand?: ProductBrand;
  images: ProductImage[];
  
  // Pricing (in BASE_CURRENCY)
  basePrice: number;
  originalBasePrice?: number;
  vouchers?: ProductVoucher[];
  
  // Social proof
  rating?: number; // 0..5
  reviewCount?: number;
  soldCount?: number;
  
  // Shipping & Delivery
  shippingOrigin?: ShippingOrigin;
  deliveryOptions?: DeliveryOption[];
  returnPolicy?: ReturnPolicy;
  
  // Inventory
  stockRemaining?: number;
  
  // Variants
  variants?: ProductVariant[];
  
  // Content
  description?: string;
  detailsHtml?: string; // sanitized HTML for Product Details tab
  
  // Related products
  recommendations?: string[]; // product ids/slugs
  sponsored?: string[]; // product ids/slugs
  
  // Store
  store?: ProductStore;
  
  // Metadata
  createdAt?: string;
  updatedAt?: string;
}

// Default return policy text per spec
export const DEFAULT_RETURN_POLICY = {
  shortLabel: "7 Days Free Return · 2 Months International Seller Warranty",
  fullText: `7 Days Free Return
Direct return to the merchant within 7 days: The seller must approve the return and refund. Once the seller accepts the return request, send the item back to the seller for a refund.`,
  warrantyMonths: 2,
};
