'use client'

import { useState, useEffect } from 'react'
import { useBrand } from '@/components/BrandProvider'
import Link from 'next/link'
import { addItem, type CartItem } from '@/lib/cart'
import { getFxRates, convertFromBase, DEFAULT_CURRENCY, BASE_CURRENCY } from '@/lib/currency'
import { formatPrice } from '@/lib/format'

function readCookie(name: string): string | null {
  if (typeof window === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

interface Product {
  id: string
  title: string
  slug: string
  price: number
  originalPrice?: number
  description: string
  longDescription: string
  category: string
  brand: string
  rating: number
  reviews: number
  onSale?: boolean
  features: string[]
  specifications: Record<string, string>
  images: string[]
}

interface ProductPageProps {
  params: { slug: string }
}

export default function ProductPage({ params }: ProductPageProps) {
  const { theme, brand } = useBrand()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [addedToCart, setAddedToCart] = useState(false)
  const [userCurrency, setUserCurrency] = useState(DEFAULT_CURRENCY)
  const [fxRates, setFxRates] = useState<Record<string, number>>({})
  const [currencyLoading, setCurrencyLoading] = useState(true)

  useEffect(() => {
    loadProduct()
    loadCurrency()
  }, [params.slug, brand])

  const loadCurrency = async () => {
    setCurrencyLoading(true)
    
    // Get currency from cookie
    const savedCurrency = readCookie('currency') || DEFAULT_CURRENCY
    setUserCurrency(savedCurrency.toUpperCase())
    
    // Fetch FX rates
    try {
      const response = await fetch('/api/fx')
      if (response.ok) {
        const data = await response.json()
        setFxRates(data.rates || {})
      }
    } catch (error) {
      console.error('Failed to fetch FX rates:', error)
      setFxRates({ [DEFAULT_CURRENCY]: 1 })
    } finally {
      setCurrencyLoading(false)
    }
  }

  const loadProduct = async () => {
    setLoading(true)
    
    // Demo product based on slug and brand
    const demoProduct: Product = brand === 'primediscreet' ? {
      id: '1',
      title: 'Elite Platinum Collection Set',
      slug: params.slug,
      price: 299.99,
      originalPrice: 399.99,
      description: 'Premium wellness collection with luxury accessories',
      longDescription: `Experience the pinnacle of luxury with our Elite Platinum Collection Set. This meticulously curated collection features premium materials, sophisticated design, and unparalleled quality. Each piece is crafted with attention to detail and designed for the discerning individual who appreciates excellence.

Our platinum-grade materials ensure durability and elegance, while the ergonomic design provides comfort and functionality. The collection includes everything you need for a complete luxury experience, packaged beautifully in our signature presentation box.

Perfect for personal use or as a sophisticated gift, this collection represents the finest in adult luxury products. Discreet shipping and our satisfaction guarantee ensure your complete confidence in your purchase.`,
      category: 'Premium Collections',
      brand: 'Platinum Elite',
      rating: 4.9,
      reviews: 127,
      onSale: true,
      features: [
        'Premium platinum-grade materials',
        'Ergonomic luxury design',
        'Complete collection set',
        'Elegant presentation packaging',
        'Discreet shipping included',
        'Satisfaction guarantee',
        'Made with body-safe materials',
        'Easy care instructions included'
      ],
      specifications: {
        'Material': 'Medical-grade platinum silicone',
        'Finish': 'Matte luxury coating',
        'Dimensions': '6.5" x 1.5" (main piece)',
        'Weight': '0.8 lbs',
        'Care': 'Easy clean with included solution',
        'Warranty': '2 years manufacturer warranty',
        'Origin': 'Designed in Switzerland',
        'Certification': 'FDA approved materials'
      },
      images: ['image1.jpg', 'image2.jpg', 'image3.jpg']
    } : {
      id: '1',
      title: 'Wellness Starter Kit',
      slug: params.slug,
      price: 79.99,
      originalPrice: 99.99,
      description: 'Complete wellness kit for beginners',
      longDescription: `Begin your wellness journey with our thoughtfully designed Starter Kit. Perfect for those new to personal wellness products, this collection includes everything you need to get started safely and comfortably.

Each item in the kit has been carefully selected for quality, safety, and ease of use. The comprehensive guide included helps you understand how to use each product effectively and safely. Made with body-safe materials and backed by our satisfaction guarantee.

Our Wellness Starter Kit is designed to help you explore personal wellness in a comfortable, private way. The discreet packaging ensures your privacy, while the included educational materials provide valuable guidance for your wellness journey.

Ideal for beginners or as a thoughtful gift for someone special in your life.`,
      category: 'Wellness',
      brand: 'EntizCare',
      rating: 4.6,
      reviews: 234,
      onSale: true,
      features: [
        'Beginner-friendly design',
        'Complete starter collection',
        'Educational guide included',
        'Body-safe materials only',
        'Discreet packaging',
        'Easy care instructions',
        'Customer support included',
        'Satisfaction guarantee'
      ],
      specifications: {
        'Material': 'Medical-grade silicone',
        'Finish': 'Smooth matte',
        'Kit Contents': '4 pieces + guide',
        'Size Range': 'Beginner to intermediate',
        'Care': 'Soap and water cleaning',
        'Warranty': '1 year warranty',
        'Origin': 'Quality tested in USA',
        'Certification': 'Phthalate-free guarantee'
      },
      images: ['image1.jpg', 'image2.jpg', 'image3.jpg']
    }

    // Simulate API delay
    setTimeout(() => {
      setProduct(demoProduct)
      setLoading(false)
    }, 500)
  }

  const handleAddToCart = () => {
    if (!product) return
    
    const cartItem: CartItem = {
      id: product.id,
      title: product.title,
      priceBase: product.price,
      qty: quantity
    }
    
    addItem(cartItem)
    setAddedToCart(true)
    
    // Reset the added state after 2 seconds
    setTimeout(() => {
      setAddedToCart(false)
    }, 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: theme.colors.background }}>
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 rounded-full mb-4 mx-auto"
               style={{ 
                 borderColor: theme.colors.glass.border,
                 borderTopColor: theme.colors.accent 
               }}></div>
          <p style={{ color: theme.colors.text.secondary }}>Loading product...</p>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: theme.colors.background }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4" style={{ color: theme.colors.text.primary }}>
            Product Not Found
          </h1>
          <p className="mb-6" style={{ color: theme.colors.text.secondary }}>
            The product you're looking for doesn't exist.
          </p>
          <Link 
            href="/store"
            className="px-6 py-3 rounded-lg font-medium transition-all hover:opacity-90"
            style={{
              backgroundColor: theme.colors.accent,
              color: brand === 'primediscreet' ? theme.colors.background : 'white'
            }}
          >
            Browse Products
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.colors.background }}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Breadcrumb */}
        <nav className="text-sm mb-6">
          <Link href="/" className="hover:opacity-70 transition-colors" style={{ color: theme.colors.text.secondary }}>
            Home
          </Link>
          <span className="mx-2" style={{ color: theme.colors.text.secondary }}>→</span>
          <Link href="/store" className="hover:opacity-70 transition-colors" style={{ color: theme.colors.text.secondary }}>
            Store
          </Link>
          <span className="mx-2" style={{ color: theme.colors.text.secondary }}>→</span>
          <span style={{ color: theme.colors.accent }}>{product.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
          
          {/* Product Images */}
          <div>
            <div className="aspect-square rounded-lg overflow-hidden mb-4"
                 style={{ backgroundColor: theme.colors.surface }}>
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4" style={{ color: theme.colors.accent }}>
                    {product.category === 'Wellness' ? '🧘' :
                     product.category === 'Premium Collections' ? '💎' : '✨'}
                  </div>
                  <p className="text-lg font-medium" style={{ color: theme.colors.text.primary }}>
                    {product.title}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Thumbnail Images */}
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className={`aspect-square rounded-lg cursor-pointer transition-all ${
                    selectedImageIndex === index ? 'ring-2' : ''
                  }`}
                  style={{ 
                    backgroundColor: theme.colors.surface,
                    ringColor: theme.colors.accent
                  }}
                  onClick={() => setSelectedImageIndex(index)}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-2xl" style={{ color: theme.colors.accent }}>
                      {index === 0 ? '📸' : index === 1 ? '🔍' : '📏'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div>
            {/* Sale Badge */}
            {product.onSale && (
              <div className="inline-block bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold mb-4">
                ON SALE
              </div>
            )}

            <h1 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: theme.colors.text.primary }}>
              {product.title}
            </h1>

            <p className="text-lg mb-4" style={{ color: theme.colors.text.secondary }}>
              by {product.brand}
            </p>

            {/* Rating */}
            <div className="flex items-center gap-2 mb-6">
              <div className="flex">
                {[1, 2, 3, 4, 5].map(star => (
                  <span 
                    key={star}
                    className="text-lg"
                    style={{ color: star <= product.rating ? theme.colors.accent : theme.colors.text.secondary }}
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
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-24 h-8 bg-gray-200 animate-pulse rounded"></div>
                  {product.originalPrice && (
                    <div className="w-20 h-6 bg-gray-200 animate-pulse rounded"></div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 mb-2">
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
                  You save {formatPrice(convertFromBase(product.originalPrice - product.price, userCurrency, fxRates), userCurrency)}!
                </p>
              )}
            </div>

            {/* Description */}
            <p className="text-lg mb-6" style={{ color: theme.colors.text.secondary }}>
              {product.description}
            </p>

            {/* Quantity and Add to Cart */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium" style={{ color: theme.colors.text.secondary }}>
                  Quantity:
                </label>
                <div className="flex items-center border rounded-lg"
                     style={{ borderColor: theme.colors.glass.border }}>
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 flex items-center justify-center hover:bg-opacity-10 transition-colors"
                    style={{ backgroundColor: theme.colors.surface }}
                    disabled={quantity <= 1}
                  >
                    −
                  </button>
                  <span className="w-16 text-center font-medium" style={{ color: theme.colors.text.primary }}>
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-10 h-10 flex items-center justify-center hover:bg-opacity-10 transition-colors"
                    style={{ backgroundColor: theme.colors.surface }}
                  >
                    +
                  </button>
                </div>
              </div>
              
              <button
                onClick={handleAddToCart}
                className="w-full py-3 px-6 rounded-lg font-medium transition-all hover:opacity-90 flex items-center justify-center gap-2"
                style={{
                  backgroundColor: addedToCart ? '#10B981' : theme.colors.accent,
                  color: 'white'
                }}
              >
                {addedToCart ? (
                  <>✓ Added to Cart!</>
                ) : currencyLoading ? (
                  <>🛒 Add to Cart - ...</>
                ) : (
                  <>🛒 Add to Cart - {formatPrice(convertFromBase(product.price * quantity, userCurrency, fxRates), userCurrency)}</>
                )}
              </button>
            </div>

            {/* Benefits */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {[
                { icon: '🚚', text: 'Free discreet shipping' },
                { icon: '🔒', text: 'Secure payment' },
                { icon: '↩️', text: '30-day returns' },
                { icon: '💬', text: '24/7 support' }
              ].map((benefit, index) => (
                <div key={index} className="flex items-center gap-2 text-sm"
                     style={{ color: theme.colors.text.secondary }}>
                  <span>{benefit.icon}</span>
                  <span>{benefit.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Product Details Tabs */}
        <div className="border-t pt-12" style={{ borderColor: theme.colors.glass.border }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            
            {/* Description */}
            <div>
              <h3 className="text-2xl font-bold mb-4" style={{ color: theme.colors.text.primary }}>
                Description
              </h3>
              <div className="prose max-w-none" style={{ color: theme.colors.text.secondary }}>
                {product.longDescription.split('\n\n').map((paragraph, index) => (
                  <p key={index} className="mb-4">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>

            {/* Features & Specs */}
            <div>
              <h3 className="text-2xl font-bold mb-4" style={{ color: theme.colors.text.primary }}>
                Features & Specifications
              </h3>
              
              <div className="mb-6">
                <h4 className="font-semibold mb-3" style={{ color: theme.colors.text.primary }}>
                  Key Features:
                </h4>
                <ul className="space-y-2">
                  {product.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm"
                        style={{ color: theme.colors.text.secondary }}>
                      <span style={{ color: theme.colors.accent }}>✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-3" style={{ color: theme.colors.text.primary }}>
                  Specifications:
                </h4>
                <dl className="space-y-2">
                  {Object.entries(product.specifications).map(([key, value]) => (
                    <div key={key} className="flex text-sm">
                      <dt className="font-medium w-24 flex-shrink-0" style={{ color: theme.colors.text.primary }}>
                        {key}:
                      </dt>
                      <dd style={{ color: theme.colors.text.secondary }}>
                        {value}
                      </dd>
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
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all hover:opacity-90"
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.glass.border,
              color: theme.colors.text.primary,
              border: `1px solid ${theme.colors.glass.border}`
            }}
          >
            ← Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  )
}