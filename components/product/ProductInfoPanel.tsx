// components/product/ProductInfoPanel.tsx
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Star, Truck, Shield, ChevronDown, ChevronUp, Share2, ShoppingCart } from "lucide-react";
import type { Product } from "@/types/product";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { convertFromBase, formatMoney } from "@/lib/currency";
import { DEFAULT_RETURN_POLICY } from "@/types/product";
import I18nText from "@/components/i18n/I18nText";

type Props = {
  product: Product;
  onAddToCart: (quantity: number, variantId?: string) => void;
  onBuyNow: (quantity: number, variantId?: string) => void;
};

export default function ProductInfoPanel({ product, onAddToCart, onBuyNow }: Props) {
  const { currency, rates } = useCurrency();
  const { locale } = useI18n();
  
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>();
  const [quantity, setQuantity] = useState(1);
  const [showReturnPolicy, setShowReturnPolicy] = useState(false);

  const selectedVariant = product.variants?.find(v => v.id === selectedVariantId);
  
  // Calculate effective price
  const effectiveBasePrice = product.basePrice + (selectedVariant?.priceDeltaBase || 0);
  const effectiveOriginalPrice = product.originalBasePrice 
    ? product.originalBasePrice + (selectedVariant?.priceDeltaBase || 0)
    : undefined;

  const price = convertFromBase(effectiveBasePrice, currency, rates);
  const originalPrice = effectiveOriginalPrice 
    ? convertFromBase(effectiveOriginalPrice, currency, rates)
    : undefined;

  // Calculate discount percentage
  const discountPercent = originalPrice && price < originalPrice
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : 0;

  // Calculate ETA for delivery
  const getDeliveryETA = () => {
    if (!product.deliveryOptions || product.deliveryOptions.length === 0) return null;
    
    const today = new Date();
    const standardOption = product.deliveryOptions.find(d => d.type === "standard");
    if (!standardOption) return null;

    const minDate = new Date(today);
    minDate.setDate(today.getDate() + standardOption.etaDaysMin);
    
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + standardOption.etaDaysMax);

    const formatDate = (date: Date) => {
      return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
    };

    return `${formatDate(minDate)}–${formatDate(maxDate)}`;
  };

  const maxStock = selectedVariant?.stockRemaining ?? product.stockRemaining ?? 999;

  return (
    <div className="space-y-6">
      {/* Brand */}
      {product.brand && (
        <div>
          <Link
            href={`/brands/${product.brand.slug}`}
            className="inline-flex items-center text-sm text-brand-secondary hover:underline"
          >
            {product.brand.name}
          </Link>
        </div>
      )}

      {/* Title */}
      <h1 className="text-2xl md:text-3xl font-bold"><I18nText text={product.title} /></h1>

      {/* Rating & Sold */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        {product.rating !== undefined && (
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-brand-secondary text-brand-secondary" />
            <span className="font-semibold">{product.rating.toFixed(1)}</span>
            {product.reviewCount && (
              <span className="text-white/60">({product.reviewCount} reviews)</span>
            )}
          </div>
        )}
        {product.soldCount && (
          <div className="text-white/60">{product.soldCount.toLocaleString()} sold</div>
        )}
      </div>

      {/* Price Block */}
      <div className="rounded-xl bg-white/5 p-4">
        <div className="flex items-baseline gap-3">
          <div className="text-3xl font-bold text-brand-secondary">
            {formatMoney(price, currency, locale)}
          </div>
          {originalPrice && (
            <div className="text-lg text-white/40 line-through">
              {formatMoney(originalPrice, currency, locale)}
            </div>
          )}
          {discountPercent > 0 && (
            <div className="rounded bg-red-500 px-2 py-0.5 text-sm font-semibold text-white">
              -{discountPercent}%
            </div>
          )}
        </div>

        {/* Vouchers */}
        {product.vouchers && product.vouchers.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {product.vouchers.map((voucher) => (
              <div
                key={voucher.id}
                className="rounded border border-brand-secondary bg-brand-secondary/10 px-2 py-1 text-xs font-medium text-brand-secondary"
              >
                {voucher.label}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shipping Origin */}
      {product.shippingOrigin && (
        <div className="flex items-start gap-2 text-sm">
          <Truck className="h-4 w-4 mt-0.5 text-white/60" />
          <div>
            <div className="text-white/60">Ship from</div>
            <div className="font-medium">
              {[
                product.shippingOrigin.area,
                product.shippingOrigin.city,
                product.shippingOrigin.province,
                product.shippingOrigin.state,
                product.shippingOrigin.country,
              ]
                .filter(Boolean)
                .join(", ")}
              {product.shippingOrigin.isOverseas && " (Overseas)"}
            </div>
          </div>
        </div>
      )}

      {/* Delivery */}
      {product.deliveryOptions && product.deliveryOptions.length > 0 && (
        <div className="space-y-2">
          {product.deliveryOptions.map((option) => {
            const fee = option.feeBase 
              ? convertFromBase(option.feeBase, currency, rates)
              : 0;
            const eta = getDeliveryETA();

            return (
              <div key={option.type} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium capitalize">{option.type}</span>
                  {eta && <span className="ml-2 text-white/60">Delivery by {eta}</span>}
                </div>
                <div className="font-medium">
                  {fee > 0 ? formatMoney(fee, currency, locale) : "FREE"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Return & Warranty */}
      <div className="border-t border-white/10 pt-4">
        <button
          onClick={() => setShowReturnPolicy(!showReturnPolicy)}
          className="flex w-full items-center justify-between text-sm hover:text-brand-secondary"
        >
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span>{product.returnPolicy?.shortLabel || DEFAULT_RETURN_POLICY.shortLabel}</span>
          </div>
          {showReturnPolicy ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showReturnPolicy && (
          <div className="mt-3 whitespace-pre-line rounded-lg bg-white/5 p-3 text-sm text-white/80">
            {product.returnPolicy?.fullText || DEFAULT_RETURN_POLICY.fullText}
          </div>
        )}
      </div>

      {/* Variants */}
      {product.variants && product.variants.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm font-medium">Select Variant</div>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((variant) => (
              <button
                key={variant.id}
                onClick={() => setSelectedVariantId(variant.id)}
                disabled={variant.stockRemaining === 0}
                className={`
                  rounded-lg border px-4 py-2 text-sm transition
                  ${
                    variant.id === selectedVariantId
                      ? "border-brand-secondary bg-brand-secondary/10 text-brand-secondary"
                      : "border-white/10 hover:border-white/30"
                  }
                  ${variant.stockRemaining === 0 ? "opacity-50 cursor-not-allowed" : ""}
                `}
              >
                {variant.name}
                {variant.stockRemaining === 0 && " (Out of stock)"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quantity */}
      <div className="flex items-center gap-4">
        <div className="text-sm font-medium">Quantity</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setQuantity(q => Math.max(1, q - 1))}
            className="h-8 w-8 rounded border border-white/10 hover:bg-white/5"
            disabled={quantity <= 1}
          >
            −
          </button>
          <input
            type="number"
            value={quantity}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (!isNaN(val)) setQuantity(Math.max(1, Math.min(maxStock, val)));
            }}
            className="w-16 rounded border border-white/10 bg-transparent px-2 py-1 text-center"
            min="1"
            max={maxStock}
          />
          <button
            onClick={() => setQuantity(q => Math.min(maxStock, q + 1))}
            className="h-8 w-8 rounded border border-white/10 hover:bg-white/5"
            disabled={quantity >= maxStock}
          >
            +
          </button>
          <span className="text-sm text-white/60">{maxStock} available</span>
        </div>
      </div>

      {/* Stock Warning */}
      {maxStock < 10 && maxStock > 0 && (
        <div className="text-sm text-orange-500">Almost sold out! Only {maxStock} left</div>
      )}

      {/* CTAs */}
      <div className="flex gap-3">
        <button
          onClick={() => onAddToCart(quantity, selectedVariantId)}
          className="flex-1 rounded-lg border border-brand-secondary bg-transparent px-6 py-3 font-semibold text-brand-secondary transition hover:bg-brand-secondary/10"
        >
          <ShoppingCart className="mr-2 inline h-5 w-5" />
          Add to Cart
        </button>
        <button
          onClick={() => onBuyNow(quantity, selectedVariantId)}
          className="flex-1 rounded-lg bg-brand-secondary px-6 py-3 font-semibold text-black transition hover:opacity-90"
        >
          Buy Now
        </button>
        <button
          className="rounded-lg border border-white/10 p-3 hover:bg-white/5"
          aria-label="Share"
        >
          <Share2 className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
