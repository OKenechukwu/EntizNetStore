// components/product/ProductDetailsTab.tsx
'use client';

import { useState } from 'react';
import { useBrand } from '@/components/BrandProvider';
import { useTranslation } from '@/hooks/useTranslation';
import Price from '@/components/ui/Price';
import I18nText from '@/components/i18n/I18nText';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';

type Variant = { label: string; value: string };

interface ProductDetailsTabsProps {
  product: {
    id: string;
    slug?: string | null;
    title: string | null;
    description: string | null;
    price: number | null;

    // Optional enhancements (all safe to omit)
    salePrice?: number | null;
    vouchers?: { code: string; label: string }[];
    store?: {
      id: string;
      name: string;
      logo?: string | null;
      totalProducts?: number;
      totalReviews?: number;
      responseTime?: string;
      responseRate?: string;
      joined?: string;
      followers?: number;
    };
    variants?: {
      type?: Variant[];
      size?: Variant[];
      color?: Variant[];
    };
    shipFrom?: string | null;
    deliveryOptions?: string[]; // e.g., ['Standard','Express']
    bundleDeals?: {
      note?: string;
      items: { id: string; slug: string; title: string; image: string; price: number }[];
    };
    reviews?: {
      id: string;
      rating: number; // 1..5
      text?: string;
      media?: string[];
      user?: string;
      date?: string;
    }[];
    related?: { id: string; slug: string; title: string; image: string; price: number }[];

    // Existing long-form fields (rendered in tabs)
    specifications?: string | null;
    certification?: string | null;
    warranty?: string | null;
    expiryDate?: string | null;
  };

  // Optional actions (safe no-ops if not provided)
  onAddToCart?: (id: string, qty: number, variant?: Record<string, string>) => void;
  onBuyNow?: (id: string, qty: number, variant?: Record<string, string>) => void;
}

export default function ProductDetailsTabs({
  product,
  onAddToCart,
  onBuyNow,
}: ProductDetailsTabsProps) {
  const { theme } = useBrand();
  const { t } = useTranslation();

  // ---- NEW: price/sale block, vouchers, selectors, qty, CTAs, chat, store strip ----
  const [qty, setQty] = useState(1);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const hasSale = !!(product.salePrice && product.price && product.salePrice < product.price);
  const percentOff =
    hasSale && product.price
      ? Math.round(((product.price - (product.salePrice as number)) / product.price) * 100)
      : 0;

  const handleAddToCart = () => onAddToCart?.(product.id, qty, picked);
  const handleBuyNow = () => onBuyNow?.(product.id, qty, picked);

  // ---- TABS (kept from your original) ----
  const [activeTab, setActiveTab] = useState('description');

  const tabs = [
    { id: 'description', label: t('description') },
    { id: 'specifications', label: t('specifications') },
    { id: 'certification', label: t('certification') || 'Certification' },
    { id: 'warranty', label: t('warranty') || 'Warranty' },
    { id: 'expiry', label: t('expiryOn') || 'Expiry On' },
    { id: 'store-policy', label: t('storePolicy') || 'Store Policy' },
    { id: 'escrow-policy', label: t('escrowPolicy') || 'Escrow Policy' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'description':
        return (
          <div className="prose max-w-none">
            <p className="whitespace-pre-wrap" style={{ color: theme.colors.text.primary }}>
              {product.description ? <I18nText text={product.description} /> : 'No description provided.'}
            </p>
          </div>
        );

      case 'specifications':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
              {t('productSpecifications') || 'Product Specifications'}
            </h3>
            <div className="space-y-2" style={{ color: theme.colors.text.secondary }}>
              {product.specifications ? (
                <p className="whitespace-pre-wrap">
                  <I18nText text={product.specifications} />
                </p>
              ) : (
                <div className="space-y-2">
                  <p><strong>Material:</strong> Premium medical-grade silicone</p>
                  <p><strong>Dimensions:</strong> Length: 6.5&quot; | Width: 1.2&quot; | Height: 1.2&quot;</p>
                  <p><strong>Weight:</strong> 4.2 oz</p>
                  <p><strong>Power Source:</strong> USB rechargeable lithium battery</p>
                  <p><strong>Battery Life:</strong> Up to 2 hours continuous use</p>
                  <p><strong>Waterproof Rating:</strong> IPX7 - fully submersible</p>
                  <p><strong>Vibration Patterns:</strong> 10 unique patterns with 5 intensity levels</p>
                  <p><strong>Noise Level:</strong> &lt;50dB whisper-quiet operation</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'certification':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
              {t('certificationsSafety') || 'Certifications & Safety'}
            </h3>
            <div className="space-y-3" style={{ color: theme.colors.text.secondary }}>
              <CertItem>FDA Certified: Medical-grade materials approved for body contact</CertItem>
              <CertItem>CE Marking: Meets European health and safety standards</CertItem>
              <CertItem>RoHS Compliant: Free from hazardous substances</CertItem>
              <CertItem>ISO 10993: Biological evaluation for medical devices</CertItem>
              <CertItem>Latex-Free: Hypoallergenic and safe for sensitive skin</CertItem>
            </div>
          </div>
        );

      case 'warranty':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
              {t('warrantyInformation') || 'Warranty Information'}
            </h3>
            <div className="space-y-3" style={{ color: theme.colors.text.secondary }}>
              <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.surface }}>
                <h4 className="font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
                  {product.warranty || '2-Year Limited Warranty'}
                </h4>
                {!product.warranty && (
                  <p>
                    We stand behind the quality of our products with a comprehensive 2-year warranty
                    covering manufacturing defects and normal wear.
                  </p>
                )}
              </div>
              {!product.warranty && (
                <>
                  <div className="space-y-2">
                    <p><strong>Coverage Includes:</strong></p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Motor and electronic components</li>
                      <li>Charging port and cable</li>
                      <li>Manufacturing defects in materials</li>
                      <li>Free replacement within first year</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <p><strong>Not Covered:</strong></p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Damage from misuse or modification</li>
                      <li>Normal wear and tear of silicone surfaces</li>
                      <li>Damage from improper cleaning</li>
                      <li>Water damage from exceeding IPX7 limits</li>
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>
        );

      case 'expiry':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
              {t('productExpiryInformation') || 'Product Expiry Information'}
            </h3>
            <div className="space-y-3" style={{ color: theme.colors.text.secondary }}>
              <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.surface }}>
                <p><strong>Recommended Usage Period:</strong> 3-5 years with proper care</p>
                {product.expiryDate && <p><strong>Expiry Date:</strong> {product.expiryDate}</p>}
              </div>
              <div className="space-y-2">
                <p><strong>Lifespan Factors:</strong></p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Frequency of use and cleaning</li>
                  <li>Storage conditions (temperature and humidity)</li>
                  <li>Quality of charging and maintenance</li>
                  <li>Exposure to extreme temperatures</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p><strong>Signs to Replace:</strong></p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Visible cracks or tears in silicone</li>
                  <li>Decreased battery life or charging issues</li>
                  <li>Changes in texture or discoloration</li>
                  <li>Reduced motor performance</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 'store-policy':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
              {t('storePolicy') || 'Store Policy'}
            </h3>
            <div className="space-y-4" style={{ color: theme.colors.text.secondary }}>
              <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.surface }}>
                <h4 className="font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
                  Return Policy
                </h4>
                <p>
                  30-day hassle-free returns for unopened items. Opened personal care items cannot
                  be returned for health and safety reasons.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold mb-1" style={{ color: theme.colors.text.primary }}>
                    Shipping
                  </h4>
                  <p>
                    Discreet packaging with 2-3 business day delivery. Free shipping on orders over{' '}
                    <Price amountUSD={75} />.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-1" style={{ color: theme.colors.text.primary }}>
                    Privacy
                  </h4>
                  <p>
                    All orders ship in plain, unmarked packaging with no indication of contents.
                    Your privacy is our priority.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-1" style={{ color: theme.colors.text.primary }}>
                    Age Verification
                  </h4>
                  <p>You must be 18+ to purchase. Adult signature required for delivery confirmation.</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'escrow-policy':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
              {t('escrowPolicy') || 'Escrow Protection Policy'}
            </h3>
            <div className="space-y-4" style={{ color: theme.colors.text.secondary }}>
              <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.surface }}>
                <h4 className="font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
                  Secure Transaction Guarantee
                </h4>
                <p>
                  Your payment is held in secure escrow until you confirm receipt and satisfaction
                  with your order.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold mb-1" style={{ color: theme.colors.text.primary }}>
                    How It Works
                  </h4>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>Your payment is securely held in escrow when you place your order</li>
                    <li>Seller ships your item with tracking confirmation</li>
                    <li>You receive and inspect your order</li>
                    <li>Payment is released to seller once you confirm satisfaction</li>
                  </ol>
                </div>

                <div>
                  <h4 className="font-semibold mb-1" style={{ color: theme.colors.text.primary }}>
                    Dispute Resolution
                  </h4>
                  <p>
                    If there's an issue with your order, our escrow team will mediate and ensure fair
                    resolution. Funds remain protected until disputes are resolved.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-1" style={{ color: theme.colors.text.primary }}>
                    Release Timeline
                  </h4>
                  <p>
                    You have 7 days after delivery to inspect and confirm your order. If no action is
                    taken, payment is automatically released to the seller.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="mt-8 space-y-6">
      {/* ---- Store strip (optional; renders only if provided) ---- */}
      {product.store?.name ? (
        <div
          className="sticky top-16 z-30 rounded-lg border p-3 backdrop-blur flex items-center gap-3"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderColor: theme.colors.glass.border }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {product.store.logo ? (
            <img src={product.store.logo} alt={product.store.name} className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full" style={{ background: theme.colors.glass.border }} />
          )}
          <div className="text-sm font-semibold" style={{ color: theme.colors.text.primary }}>
            {product.store.name}
          </div>
          <div className="text-xs ml-auto flex gap-3" style={{ color: theme.colors.text.secondary }}>
            {typeof product.store.totalProducts === 'number' && <span>{product.store.totalProducts} products</span>}
            {typeof product.store.totalReviews === 'number' && <span>{product.store.totalReviews} reviews</span>}
            {product.store.responseRate && product.store.responseTime && (
              <span>Resp. {product.store.responseRate} • {product.store.responseTime}</span>
            )}
            {product.store.joined && <span>Joined {product.store.joined}</span>}
            {typeof product.store.followers === 'number' && <span>{product.store.followers} followers</span>}
          </div>
          {product.store.id && (
            <Link href={`/store/${product.store.id}`} className="ml-3 px-3 py-1 rounded hover:opacity-90"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: theme.colors.text.primary }}>
              Visit Store
            </Link>
          )}
        </div>
      ) : null}

      {/* ---- Price / sale / vouchers / selectors / qty / CTAs / chat ---- */}
      <section className="space-y-4">
        {/* Title */}
        {product.title ? (
          <h1 className="text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
            <I18nText text={product.title} />
          </h1>
        ) : null}

        {/* Price block */}
        <div className="flex items-end gap-3">
          <div className="text-2xl font-extrabold" style={{ color: theme.colors.text.primary }}>
            {/* Use your Price component to respect currency selection */}
            <Price amountUSD={Number(hasSale ? product.salePrice : product.price) || 0} />
          </div>
          {hasSale && product.price != null && product.salePrice != null && (
            <>
              <div className="line-through opacity-60">
                <Price amountUSD={Number(product.price)} />
              </div>
              <div className="font-semibold" style={{ color: '#4ade80' /* green-400 */ }}>
                {percentOff}% OFF
              </div>
              <div className="text-xs opacity-80" style={{ color: theme.colors.text.secondary }}>
                You save <Price amountUSD={Number(product.price - product.salePrice)} />
              </div>
            </>
          )}
        </div>

        {/* Vouchers / coupons */}
        {product.vouchers?.length ? (
          <div className="flex flex-wrap gap-2">
            {product.vouchers.map((v) => (
              <div
                key={v.code}
                className="text-xs px-2 py-1 rounded-full border"
                title={v.code}
                style={{
                  backgroundColor: 'rgba(234, 179, 8, 0.2)', // yellow-300/20
                  borderColor: 'rgba(234, 179, 8, 0.3)',
                  color: '#fde68a', // yellow-200
                }}
              >
                {v.label}
              </div>
            ))}
          </div>
        ) : null}

        {/* Variant selectors (if provided) */}
        <div className="space-y-3">
          {product.variants?.type && (
            <Selector
              label="Type"
              items={product.variants.type}
              active={picked.type}
              onPick={(v) => setPicked((p) => ({ ...p, type: v }))}
              theme={theme}
            />
          )}
          {product.variants?.size && (
            <Selector
              label="Size"
              items={product.variants.size}
              active={picked.size}
              onPick={(v) => setPicked((p) => ({ ...p, size: v }))}
              theme={theme}
            />
          )}
          {product.variants?.color && (
            <Selector
              label="Color"
              items={product.variants.color}
              active={picked.color}
              onPick={(v) => setPicked((p) => ({ ...p, color: v }))}
              theme={theme}
            />
          )}

          {/* Meta above quantity */}
          <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
            <div>Return / Warranty: 30 days</div>
            {product.shipFrom ? <div>Ships from: {product.shipFrom}</div> : null}
            {product.deliveryOptions?.length ? (
              <div>Delivery: {product.deliveryOptions.join(' • ')}</div>
            ) : null}
          </div>
        </div>

        {/* Quantity + CTA (same row) */}
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded border" style={{ borderColor: theme.colors.glass.border }}>
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="px-3 py-2"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <input
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              className="w-14 text-center px-2 py-2 rounded"
              style={{ backgroundColor: '#fff', color: '#000' }} // black digits on white
              inputMode="numeric"
              aria-label="Quantity"
            />
            <button
              onClick={() => setQty((q) => q + 1)}
              className="px-3 py-2"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>

          <button
            onClick={handleAddToCart}
            className="px-4 py-2 rounded font-semibold"
            style={{ background: 'var(--brand-secondary, #D1B000)', color: '#000' }}
          >
            {t('addToCart') || 'Add to Cart'}
          </button>
          <button
            onClick={handleBuyNow}
            className="px-4 py-2 rounded border hover:bg-white/10"
            style={{ borderColor: theme.colors.glass.border, color: theme.colors.text.primary }}
          >
            {t('buyNow') || 'Buy Now'}
          </button>

          {/* Chat (with product context in URL) */}
          {product.slug ? (
            <Link
              href={`/messages/new?product=${product.slug}`}
              className="ml-auto flex items-center gap-1 px-3 py-2 rounded hover:bg-white/10"
              style={{ color: theme.colors.text.primary, borderColor: theme.colors.glass.border }}
            >
              <MessageCircle className="w-4 h-4" />
              {t('chat') || 'Chat'}
            </Link>
          ) : null}
        </div>
      </section>

      {/* ---- Tabs (unchanged visual) ---- */}
      <div className="border-b" style={{ borderColor: theme.colors.glass.border }}>
        <nav className="flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id ? 'border-current' : 'border-transparent hover:border-current'
              }`}
              style={{
                color: activeTab === tab.id ? theme.colors.accent : theme.colors.text.secondary,
                borderBottomColor: activeTab === tab.id ? theme.colors.accent : 'transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="py-6">{renderTabContent()}</div>

      {/* ---- Bundle deals (same store) ---- */}
      {product.bundleDeals?.items?.length ? (
        <section>
          <h3 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
            Best Bundle Deals from this Store
          </h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
            {product.bundleDeals.items.map((b) => (
              <Link
                key={b.id}
                href={`/products/${b.slug}`}
                className="rounded border p-2 hover:bg-white/5"
                style={{ borderColor: theme.colors.glass.border }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.image} alt={b.title} className="rounded mb-2" />
                <div className="text-sm font-medium truncate" style={{ color: theme.colors.text.primary }}>
                  <I18nText text={b.title} />
                </div>
                <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
                  <Price amountUSD={b.price} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---- Reviews ---- */}
      {product.reviews?.length ? (
        <section className="space-y-2">
          <h3 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
            Reviews
          </h3>
          {product.reviews.map((r) => (
            <div
              key={r.id}
              className="rounded border p-3 space-y-2"
              style={{ borderColor: theme.colors.glass.border, color: theme.colors.text.secondary }}
            >
              <div className="text-sm opacity-80">
                {'★'.repeat(r.rating)}
                {'☆'.repeat(5 - r.rating)}
              </div>
              {r.text ? (
                <div className="text-sm" style={{ color: theme.colors.text.primary }}>
                  <I18nText text={r.text} />
                </div>
              ) : null}
              {r.media?.length ? (
                <div className="flex gap-2">
                  {r.media.map((m, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={m} alt="" className="w-20 h-20 object-cover rounded" />
                  ))}
                </div>
              ) : null}
              <div className="text-xs opacity-60">
                {r.user} {r.date ? `• ${r.date}` : ''}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {/* ---- Related products ---- */}
      {product.related?.length ? (
        <section className="space-y-2">
          <h3 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
            You may also like
          </h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {product.related.map((rel) => (
              <Link
                key={rel.id}
                href={`/products/${rel.slug}`}
                className="rounded border p-2 hover:bg-white/5"
                style={{ borderColor: theme.colors.glass.border }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={rel.image} alt={rel.title} className="rounded mb-2" />
                <div className="text-sm font-medium truncate" style={{ color: theme.colors.text.primary }}>
                  <I18nText text={rel.title} />
                </div>
                <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
                  <Price amountUSD={rel.price} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/* ---------- Small helpers ---------- */

function Selector({
  label,
  items,
  active,
  onPick,
  theme,
}: {
  label: string;
  items: { label: string; value: string }[];
  active?: string;
  onPick: (v: string) => void;
  theme: any;
}) {
  return (
    <div className="text-sm">
      <div className="mb-1" style={{ color: theme.colors.text.secondary }}>
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onPick(opt.value)}
            className="px-3 py-1 rounded border"
            style={{
              borderColor: active === opt.value ? 'rgba(234, 179, 8, 0.5)' : theme.colors.glass.border,
              backgroundColor: active === opt.value ? 'rgba(234, 179, 8, 0.2)' : 'transparent',
              color: theme.colors.text.primary,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CertItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e' /* green-500 */ }} />
      <span>{children}</span>
    </div>
  );
}
