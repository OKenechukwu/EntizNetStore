// app/products/[slug]/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useBrand } from "@/components/BrandProvider";
import { addItem, type CartItem } from "@/lib/cart";
import { convertFromBase, DEFAULT_CURRENCY } from "@/lib/currency";
import { formatPrice } from "@/lib/format";

function readCookie(name: string): string | null {
  if (typeof window === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

interface Product {
  id: string;
  title: string;
  slug: string;
  price: number;
  originalPrice?: number;
  description: string;
  longDescription: string;
  category: string;
  brand: string;
  rating: number;
  reviews: number;
  onSale?: boolean;
  features: string[];
  specifications: Record<string, string>;
  images: string[]; // absolute/public paths recommended
}

interface ProductPageProps {
  params: { slug: string };
}

export default function ProductPage({ params }: ProductPageProps) {
  const { theme, brand } = useBrand();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [userCurrency, setUserCurrency] = useState(DEFAULT_CURRENCY);
  const [fxRates, setFxRates] = useState<Record<string, number>>({ [DEFAULT_CURRENCY]: 1 });
  const [currencyLoading, setCurrencyLoading] = useState(true);

  // Memo’d image list so we never index into undefined
  const images = useMemo<string[]>(
    () =>
      product?.images?.length
        ? product.images
        : [
            // Safe, existing placeholders — change to your real asset paths anytime
            "/attached_assets/stock_images/luxury_adult_product_04d5ddeb.jpg",
            "/attached_assets/stock_images/luxury_adult_product_04d5ddeb.jpg",
            "/attached_assets/stock_images/luxury_adult_product_04d5ddeb.jpg",
          ],
    [product]
  );

  useEffect(() => {
    loadProduct();
    // reset preview image when navigating between products
    setSelectedImageIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.slug, brand]);

  useEffect(() => {
    loadCurrency();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll for currency cookie change (simple, resilient)
  useEffect(() => {
    const interval = setInterval(() => {
      const current = (readCookie("currency") || DEFAULT_CURRENCY).toUpperCase();
      if (current !== userCurrency) loadCurrency();
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCurrency]);

  const loadCurrency = async () => {
    setCurrencyLoading(true);
    try {
      const saved = (readCookie("currency") || DEFAULT_CURRENCY).toUpperCase();
      setUserCurrency(saved);

      const res = await fetch("/api/fx", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const rates = (data?.rates ?? {}) as Record<string, number>;
        setFxRates(Object.keys(rates).length ? rates : { [DEFAULT_CURRENCY]: 1 });
      } else {
        setFxRates({ [DEFAULT_CURRENCY]: 1 });
      }
    } catch {
      setFxRates({ [DEFAULT_CURRENCY]: 1 });
    } finally {
      setCurrencyLoading(false);
    }
  };

  const loadProduct = async () => {
    setLoading(true);

    // TODO: replace with a real fetch to your DB/API.
    // For now, we provide a robust demo based on brand + slug so the page never blanks.
    const demoProduct: Product =
      brand === "primediscreet"
        ? {
            id: "1",
            title: "Elite Platinum Collection Set",
            slug: params.slug,
            price: 299.99,
            originalPrice: 399.99,
            description: "Premium wellness collection with luxury accessories",
            longDescription: `Experience the pinnacle of luxury with our Elite Platinum Collection Set. This meticulously curated collection features premium materials, sophisticated design, and unparalleled quality. Each piece is crafted with attention to detail and designed for the discerning individual who appreciates excellence.

Our platinum-grade materials ensure durability and elegance, while the ergonomic design provides comfort and functionality. The collection includes everything you need for a complete luxury experience, packaged beautifully in our signature presentation box.

Perfect for personal use or as a sophisticated gift, this collection represents the finest in adult luxury products. Discreet shipping and our satisfaction guarantee ensure your complete confidence in your purchase.`,
            category: "Premium Collections",
            brand: "Platinum Elite",
            rating: 4.9,
            reviews: 127,
            onSale: true,
            features: [
              "Premium platinum-grade materials",
              "Ergonomic luxury design",
              "Complete collection set",
              "Elegant presentation packaging",
              "Discreet shipping included",
              "Satisfaction guarantee",
              "Made with body-safe materials",
              "Easy care instructions included",
            ],
            specifications: {
              Material: "Medical-grade platinum silicone",
              Finish: "Matte luxury coating",
              Dimensions: '6.5" x 1.5" (main piece)',
              Weight: "0.8 lbs",
              Care: "Easy clean with included solution",
              Warranty: "2 years manufacturer warranty",
              Origin: "Designed in Switzerland",
              Certification: "FDA approved materials",
            },
            images,
          }
        : {
            id: "1",
            title: "Wellness Starter Kit",
            slug: params.slug,
            price: 79.99,
            originalPrice: 99.99,
            description: "Complete wellness kit for beginners",
            longDescription: `Begin your wellness journey with our thoughtfully designed Starter Kit. Perfect for those new to personal wellness products, this collection includes everything you need to get started safely and comfortably.

Each item in the kit has been carefully selected for quality, safety, and ease of use. The comprehensive guide included helps you understand how to use each product effectively and safely. Made with body-safe materials and backed by our satisfaction guarantee.

Our Wellness Starter Kit is designed to help you explore personal wellness in a comfortable, private way. The discreet packaging ensures your privacy, while the included educational materials provide valuable guidance for your wellness journey.

Ideal for beginners or as a thoughtful gift for someone special in your life.`,
            category: "Wellness",
            brand: "EntizCare",
            rating: 4.6,
            reviews: 234,
            onSale: true,
            features: [
              "Beginner-friendly design",
              "Complete starter collection",
              "Educational guide included",
              "Body-safe materials only",
              "Discreet packaging",
              "Easy care instructions",
              "Customer support included",
              "Satisfaction guarantee",
            ],
            specifications: {
              Material: "Medical-grade silicone",
              Finish: "Smooth matte",
              "Kit Contents": "4 pieces + guide",
              "Size Range": "Beginner to intermediate",
              Care: "Soap and water cleaning",
              Warranty: "1 year warranty",
              Origin: "Quality tested in USA",
              Certification: "Phthalate-free guarantee",
            },
            images,
          };

    // Simulate I/O delay to mimic real fetch
    setTimeout(() => {
      setProduct(demoProduct);
      setLoading(false);
    }, 300);
  };

  const handleAddToCart = () => {
    if (!product) return;

    const cartItem: CartItem = {
      id: product.id,
      title: product.title,
      priceBase: product.price,
      qty: quantity,
    };

    addItem(cartItem);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 1600);
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: theme.colors.background }}
      >
        <div className="text-center">
          <div
            className="animate-spin w-8 h-8 border-2 rounded-full mb-4 mx-auto"
            style={{
              borderColor: theme.colors.glass.border,
              borderTopColor: theme.colors.accent,
            }}
          />
          <p style={{ color: theme.colors.text.secondary }}>Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: theme.colors.background }}
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4" style={{ color: theme.colors.text.primary }}>
            Product Not Found
          </h1>
          <p className="mb-6" style={{ color: theme.colors.text.secondary }}>
            The product you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link
            href="/store"
            className="px-6 py-3 rounded-lg font-medium transition-all hover:opacity-90"
            style={{
              backgroundColor: theme.colors.accent,
              color: "white",
            }}
          >
            Browse Products
          </Link>
        </div>
      </div>
    );
  }

  const mainImage = images[Math.max(0, Math.min(selectedImageIndex, images.length - 1))];

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.colors.background }}>
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm">
          <Link
            href="/"
            className="transition-colors hover:opacity-70"
            style={{ color: theme.colors.text.secondary }}
          >
            Home
          </Link>
          <span className="mx-2" style={{ color: theme.colors.text.secondary }}>
            →
          </span>
          <Link
            href="/store"
            className="transition-colors hover:opacity-70"
            style={{ color: theme.colors.text.secondary }}
          >
            Store
          </Link>
          <span className="mx-2" style={{ color: theme.colors.text.secondary }}>
            →
          </span>
          <span style={{ color: theme.colors.accent }}>{product.title}</span>
        </nav>

        <div className="mb-12 grid grid-cols-1 gap-12 lg:grid-cols-2">
          {/* Product Images */}
          <div>
            <div
              className="mb-4 aspect-square overflow-hidden rounded-lg"
              style={{ backgroundColor: theme.colors.surface }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mainImage}
                alt={product.title}
                className="h-full w-full object-cover"
              />
            </div>

            {/* Thumbnails */}
            <div className="grid grid-cols-3 gap-2">
              {images.map((src, index) => {
                const active = selectedImageIndex === index;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setSelectedImageIndex(index)}
                    className={`aspect-square rounded-lg transition-all ${
                      active ? "ring-2" : ""
                    }`}
                    aria-label={`Preview image ${index + 1}`}
                    style={{
                      backgroundColor: theme.colors.surface,
                      // @ts-expect-error custom theme var—safe at runtime
                      ringColor: theme.colors.accent,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`${product.title} thumbnail ${index + 1}`}
                      className="h-full w-full rounded-lg object-cover"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Info */}
          <div>
            {product.onSale && (
              <div className="mb-4 inline-block rounded-full bg-red-500 px-3 py-1 text-sm font-bold text-white">
                ON SALE
              </div>
            )}

            <h1 className="mb-4 text-3xl font-bold md:text-4xl" style={{ color: theme.colors.text.primary }}>
              {product.title}
            </h1>

            <p className="mb-4 text-lg" style={{ color: theme.colors.text.secondary }}>
              by {product.brand}
            </p>

            {/* Rating */}
            <div className="mb-6 flex items-center gap-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className="text-lg"
                    style={{
                      color: star <= Math.round(product.rating) ? theme.colors.accent : theme.colors.text.secondary,
                    }}
                  >
                    ★
                  </span>
                ))}
              </div>
              <span className="text-sm" style={{ color: theme.colors.text.secondary }}>
                {product.rating} ({product.reviews} reviews)
              </span>
            </div>

            {/* Price */}
            <div className="mb-6">
              {currencyLoading ? (
                <div className="mb-2 flex items-center gap-3">
                  <div className="h-8 w-24 animate-pulse rounded bg-gray-200" />
                  {product.originalPrice && <div className="h-6 w-20 animate-pulse rounded bg-gray-200" />}
                </div>
              ) : (
                <div className="mb-2 flex items-center gap-3">
                  <span className="text-3xl font-bold" style={{ color: theme.colors.accent }}>
                    {formatPrice(convertFromBase(product.price, userCurrency, fxRates), userCurrency)}
                  </span>
                  {product.originalPrice && (
                    <span className="text-xl line-through" style={{ color: theme.colors.text.secondary }}>
                      {formatPrice(convertFromBase(product.originalPrice, userCurrency, fxRates), userCurrency)}
                    </span>
                  )}
                </div>
              )}
              {product.originalPrice && !currencyLoading && (
                <p className="text-sm font-medium text-green-600">
                  You save{" "}
                  {formatPrice(
                    convertFromBase(product.originalPrice - product.price, userCurrency, fxRates),
                    userCurrency
                  )}
                  !
                </p>
              )}
            </div>

            {/* Description */}
            <p className="mb-6 text-lg" style={{ color: theme.colors.text.secondary }}>
              {product.description}
            </p>

            {/* Quantity and Add to Cart */}
            <div className="mb-8 space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium" style={{ color: theme.colors.text.secondary }}>
                  Quantity:
                </label>
                <div
                  className="flex items-center rounded-lg border"
                  style={{ borderColor: theme.colors.glass.border }}
                >
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="flex h-10 w-10 items-center justify-center transition-colors hover:bg-opacity-10"
                    style={{ backgroundColor: theme.colors.surface }}
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="w-16 text-center font-medium" style={{ color: theme.colors.text.primary }}>
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="flex h-10 w-10 items-center justify-center transition-colors hover:bg-opacity-10"
                    style={{ backgroundColor: theme.colors.surface }}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 font-medium transition-all hover:opacity-90"
                style={{
                  backgroundColor: addedToCart ? "#10B981" : theme.colors.accent,
                  color: "white",
                }}
              >
                {addedToCart ? (
                  <>✓ Added to Cart!</>
                ) : currencyLoading ? (
                  <>🛒 Add to Cart - …</>
                ) : (
                  <>
                    🛒 Add to Cart -{" "}
                    {formatPrice(convertFromBase(product.price * quantity, userCurrency, fxRates), userCurrency)}
                  </>
                )}
              </button>
            </div>

            {/* Benefits */}
            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
              {[
                { icon: "🚚", text: "Free discreet shipping" },
                { icon: "🔒", text: "Secure payment" },
                { icon: "↩️", text: "30-day returns" },
                { icon: "💬", text: "24/7 support" },
              ].map((benefit, index) => (
                <div key={index} className="flex items-center gap-2 text-sm" style={{ color: theme.colors.text.secondary }}>
                  <span>{benefit.icon}</span>
                  <span>{benefit.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Product Details Tabs */}
        <div className="border-t pt-12" style={{ borderColor: theme.colors.glass.border }}>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
            {/* Description */}
            <div>
              <h3 className="mb-4 text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
                Description
              </h3>
              <div className="prose max-w-none" style={{ color: theme.colors.text.secondary }}>
                {product.longDescription.split("\n\n").map((paragraph, index) => (
                  <p key={index} className="mb-4">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>

            {/* Features & Specs */}
            <div>
              <h3 className="mb-4 text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
                Features & Specifications
              </h3>

              <div className="mb-6">
                <h4 className="mb-3 font-semibold" style={{ color: theme.colors.text.primary }}>
                  Key Features:
                </h4>
                <ul className="space-y-2">
                  {product.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm" style={{ color: theme.colors.text.secondary }}>
                      <span style={{ color: theme.colors.accent }}>✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="mb-3 font-semibold" style={{ color: theme.colors.text.primary }}>
                  Specifications:
                </h4>
                <dl className="space-y-2">
                  {Object.entries(product.specifications).map(([key, value]) => (
                    <div key={key} className="flex text-sm">
                      <dt className="w-28 flex-shrink-0 font-medium" style={{ color: theme.colors.text.primary }}>
                        {key}:
                      </dt>
                      <dd style={{ color: theme.colors.text.secondary }}>{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Back to Store */}
        <div className="mt-12 text-center">
          <Link
            href="/store"
            className="inline-flex items-center gap-2 rounded-lg px-6 py-3 font-medium transition-all hover:opacity-90"
            style={{
              backgroundColor: theme.colors.surface,
              color: theme.colors.text.primary,
              border: `1px solid ${theme.colors.glass.border}`,
            }}
          >
            ← Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
