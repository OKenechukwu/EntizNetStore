// components/product/ProductInfoPanel.tsx
"use client";

import { useState } from "react";
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

  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(
    () => product.variants?.find((variant) => variant.stockRemaining !== 0)?.id,
  );
  const [quantity, setQuantity] = useState(1);
  const [showReturnPolicy, setShowReturnPolicy] = useState(false);

  const selectedVariant = product.variants?.find((v) => v.id === selectedVariantId);

  const effectiveBasePrice = product.basePrice + (selectedVariant?.priceDeltaBase || 0);
  const effectiveOriginalPrice = product.originalBasePrice
    ? product.originalBasePrice + (selectedVariant?.priceDeltaBase || 0)
    : undefined;

  const price = convertFromBase(effectiveBasePrice, currency, rates ?? undefined);
  const originalPrice = effectiveOriginalPrice
    ? convertFromBase(effectiveOriginalPrice, currency, rates ?? undefined)
    : undefined;

  const discountPercent = originalPrice && price < originalPrice
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : 0;

  const getDeliveryETA = () => {
    if (!product.deliveryOptions || product.deliveryOptions.length === 0) return null;

    const today = new Date();
    const standardOption = product.deliveryOptions.find((d) => d.type === "standard");
    if (!standardOption) return null;

    const minDate = new Date(today);
    minDate.setDate(today.getDate() + standardOption.etaDaysMin);

    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + standardOption.etaDaysMax);

    const formatDate = (date: Date) => date.toLocaleDateString(locale, { month: "short", day: "numeric" });
    return `${formatDate(minDate)}–${formatDate(maxDate)}`;
  };

  const maxStock = selectedVariant
    ? selectedVariant.stockRemaining ?? 999
    : product.variants?.length
      ? 0
      : product.stockRemaining ?? 999;

  return (
    <div className="space-y-6">
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

      <h1 className="text-2xl font-bold md:text-3xl"><I18nText text={product.title} /></h1>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        {product.rating !== undefined && (
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-brand-secondary text-brand-secondary" />
            <span className="font-semibold">{product.rating.toFixed(1)}</span>
            {product.reviewCount ? (
              <span className="text-foreground opacity-70">({product.reviewCount} reviews)</span>
            ) : null}
          </div>
        )}
        {product.soldCount ? (
          <div className="text-foreground opacity-70">{product.soldCount.toLocaleString()} sold</div>
        ) : null}
      </div>

      <div className="rounded-xl bg-white/5 p-4">
        <div className="flex items-baseline gap-3">
          <div className="text-3xl font-bold text-brand-secondary">
            {formatMoney(price, currency, locale)}
          </div>
          {originalPrice ? (
            <div className="text-lg text-foreground opacity-70 line-through">
              {formatMoney(originalPrice, currency, locale)}
            </div>
          ) : null}
          {discountPercent > 0 ? (
            <div className="rounded bg-red-500 px-2 py-0.5 text-sm font-semibold text-white">
              -{discountPercent}%
            </div>
          ) : null}
        </div>

        {product.vouchers && product.vouchers.length > 0 ? (
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
        ) : null}
      </div>

      {product.shippingOrigin ? (
        <div className="flex items-start gap-2 text-sm">
          <Truck className="mt-0.5 h-4 w-4 text-foreground opacity-70" />
          <div>
            <div className="text-foreground opacity-70">Ship from</div>
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
      ) : null}

      {product.deliveryOptions && product.deliveryOptions.length > 0 ? (
        <div className="space-y-2">
          {product.deliveryOptions.map((option) => {
            const fee = option.feeBase
              ? convertFromBase(option.feeBase, currency, rates ?? undefined)
              : 0;
            const eta = getDeliveryETA();

            return (
              <div key={option.type} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium capitalize">{option.type}</span>
                  {eta ? <span className="ml-2 text-foreground opacity-70">Delivery by {eta}</span> : null}
                </div>
                <div className="font-medium">
                  {fee > 0 ? formatMoney(fee, currency, locale) : "FREE"}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={() => setShowReturnPolicy(!showReturnPolicy)}
          className="flex w-full items-center justify-between text-sm hover:text-brand-secondary"
          aria-expanded={showReturnPolicy}
        >
          <span className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span>{product.returnPolicy?.shortLabel || DEFAULT_RETURN_POLICY.shortLabel}</span>
          </span>
          {showReturnPolicy ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showReturnPolicy ? (
          <div className="mt-3 whitespace-pre-line rounded-lg bg-white/5 p-3 text-sm text-foreground opacity-80">
            {product.returnPolicy?.fullText || DEFAULT_RETURN_POLICY.fullText}
          </div>
        ) : null}
      </div>

      {product.variants && product.variants.length > 0 ? (
        <div className="space-y-3">
          <div className="text-sm font-medium">Select Variant</div>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                onClick={() => setSelectedVariantId(variant.id)}
                disabled={variant.stockRemaining === 0}
                className={`
                  rounded-lg border px-4 py-2 text-sm transition
                  ${
                    variant.id === selectedVariantId
                      ? "border-brand-secondary bg-brand-secondary/10 text-brand-secondary"
                      : "border-white/10 hover:border-white/30"
                  }
                  ${variant.stockRemaining === 0 ? "cursor-not-allowed opacity-50" : ""}
                `}
              >
                {variant.name}
                {variant.stockRemaining === 0 && " (Out of stock)"}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <label htmlFor="product-quantity" className="text-sm font-medium">Quantity</label>
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="h-[44px] w-[44px] shrink-0 rounded border border-white/10 hover:bg-white/5"
            disabled={quantity <= 1}
            aria-label="Decrease product quantity"
          >
            −
          </button>
          <input
            id="product-quantity"
            type="number"
            value={quantity}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (!Number.isNaN(val)) setQuantity(Math.max(1, Math.min(maxStock, val)));
            }}
            className="min-h-11 w-16 rounded border border-white/10 bg-transparent px-2 py-1 text-center"
            min="1"
            max={maxStock}
          />
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(maxStock, q + 1))}
            className="h-[44px] w-[44px] shrink-0 rounded border border-white/10 hover:bg-white/5"
            disabled={quantity >= maxStock}
            aria-label="Increase product quantity"
          >
            +
          </button>
          <span className="text-sm text-foreground opacity-70">{maxStock} available</span>
        </div>
      </div>

      {maxStock < 10 && maxStock > 0 ? (
        <div className="text-sm text-orange-500">Almost sold out! Only {maxStock} left</div>
      ) : null}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onAddToCart(quantity, selectedVariantId)}
          disabled={maxStock < 1}
          className="flex-1 rounded-lg border border-brand-secondary bg-transparent px-6 py-3 font-semibold text-brand-secondary transition hover:bg-brand-secondary/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShoppingCart className="mr-2 inline h-5 w-5" />
          Add to Cart
        </button>
        <button
          type="button"
          onClick={() => onBuyNow(quantity, selectedVariantId)}
          disabled={maxStock < 1}
          className="flex-1 rounded-lg bg-brand-secondary px-6 py-3 font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Buy Now
        </button>
        <button
          type="button"
          className="rounded-lg border border-white/10 p-3 hover:bg-white/5"
          aria-label="Share product"
        >
          <Share2 className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
