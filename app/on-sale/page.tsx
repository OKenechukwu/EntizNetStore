'use client'

import { useState, useEffect } from 'react'
import { useBrand } from '@/components/BrandProvider'
import Link from 'next/link'
import Price from '@/components/ui/Price'
import I18nText from '@/components/i18n/I18nText'

interface SaleProduct {
  id: string
  title: string
  slug: string
  base_price: number
  compare_at_price: number
  category: string
  brand: string
  rating: number
  review_count: number
  discount_percentage: number
  sale_end_date: string
  limited_stock?: boolean
}

type FxRates = Record<string, number> | null

export default function OnSalePage() {
  const { theme, brand } = useBrand()
  const [products, setProducts] = useState<SaleProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('discount')
  const [filterCategory, setFilterCategory] = useState('all')
  const [rates, setRates] = useState<FxRates>(null) // ⬅️ FX rates for Price

  // Fetch FX rates once (client-side)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        // Adjust if your endpoint differs. Expected: { base: "USD", rates: { EUR: 0.93, ... } }
        const res = await fetch('/api/currency/rates?base=USD', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to fetch rates')
        const json = await res.json()
        if (mounted) setRates(json?.rates ?? null)
      } catch {
        if (mounted) setRates(null) // Price will still show symbol without conversion
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    loadSaleProducts()
  }, [brand, sortBy])

  const loadSaleProducts = async () => {
    setLoading(true)
    
    // Demo sale products based on brand
    const demoProducts: SaleProduct[] = brand === 'primediscreet' ? [
      {
        id: '1', title: 'Elite Platinum Collection Set', slug: 'elite-platinum-collection',
        base_price: 299.99, compare_at_price: 399.99, category: 'Premium Collections',
        brand: 'Platinum Elite', rating: 4.9, review_count: 127,
        discount_percentage: 25, sale_end_date: '2025-01-15', limited_stock: true
      },
      {
        id: '2', title: 'Designer Silk Collection', slug: 'designer-silk-collection',
        base_price: 149.99, compare_at_price: 199.99, category: 'Designer Lingerie',
        brand: 'Silk Dreams', rating: 4.7, review_count: 156,
        discount_percentage: 25, sale_end_date: '2025-01-20'
      },
      {
        id: '3', title: 'Elite Wellness Starter Set', slug: 'elite-wellness-starter',
        base_price: 179.99, compare_at_price: 229.99, category: 'Luxury Wellness',
        brand: 'Elite Wellness', rating: 4.6, review_count: 201,
        discount_percentage: 22, sale_end_date: '2025-01-25'
      },
      {
        id: '4', title: 'Artisan Crystal Holiday Set', slug: 'artisan-crystal-holiday',
        base_price: 219.99, compare_at_price: 299.99, category: 'Artisan Crafted',
        brand: 'Crystal Artisans', rating: 4.8, review_count: 89,
        discount_percentage: 27, sale_end_date: '2025-01-10', limited_stock: true
      },
      {
        id: '5', title: 'Luxury Couples Bundle', slug: 'luxury-couples-bundle',
        base_price: 199.99, compare_at_price: 279.99, category: 'Couples Elite',
        brand: 'Intimate Elite', rating: 4.9, review_count: 76,
        discount_percentage: 29, sale_end_date: '2025-01-30'
      },
      {
        id: '6', title: 'Gold Anniversary Collection', slug: 'gold-anniversary-collection',
        base_price: 349.99, compare_at_price: 449.99, category: 'Artisan Crafted',
        brand: 'Gold Artisans', rating: 5.0, review_count: 45,
        discount_percentage: 22, sale_end_date: '2025-02-01'
      }
    ] : [
      {
        id: '1', title: 'Starter Wellness Kit', slug: 'starter-wellness-kit',
        base_price: 79.99, compare_at_price: 99.99, category: 'Wellness',
        brand: 'EntizCare', rating: 4.6, review_count: 234,
        discount_percentage: 20, sale_end_date: '2025-01-15'
      },
      {
        id: '2', title: 'Essential Care Bundle', slug: 'essential-care-bundle',
        base_price: 59.99, compare_at_price: 79.99, category: 'Essentials',
        brand: 'EntizCare', rating: 4.4, review_count: 312,
        discount_percentage: 25, sale_end_date: '2025-01-20', limited_stock: true
      },
      {
        id: '3', title: 'Wellness Journey Kit', slug: 'wellness-journey-kit',
        base_price: 199.99, compare_at_price: 249.99, category: 'Wellness',
        brand: 'Journey+', rating: 4.8, review_count: 98,
        discount_percentage: 20, sale_end_date: '2025-01-25'
      },
      {
        id: '4', title: 'Comfort Massage Holiday Set', slug: 'comfort-massage-holiday',
        base_price: 109.99, compare_at_price: 149.99, category: 'Massage',
        brand: 'ComfortZone', rating: 4.5, review_count: 145,
        discount_percentage: 27, sale_end_date: '2025-01-10'
      },
      {
        id: '5', title: 'Couples Communication Kit', slug: 'couples-communication-kit',
        base_price: 89.99, compare_at_price: 119.99, category: 'Couples',
        brand: 'Together+', rating: 4.7, review_count: 123,
        discount_percentage: 25, sale_end_date: '2025-01-30'
      },
      {
        id: '6', title: 'Complete Care Package', slug: 'complete-care-package',
        base_price: 129.99, compare_at_price: 179.99, category: 'Personal Care',
        brand: 'CareFirst', rating: 4.3, review_count: 89,
        discount_percentage: 28, sale_end_date: '2025-02-01', limited_stock: true
      }
    ]

    // Sort products based on sortBy criteria
    const sortedProducts = [...demoProducts].sort((a, b) => {
      switch (sortBy) {
        case 'discount':
          return b.discount_percentage - a.discount_percentage
        case 'savings':
          return (b.compare_at_price - b.base_price) - (a.compare_at_price - a.base_price)
        case 'price-low':
          return a.base_price - b.base_price
        case 'price-high':
          return b.base_price - a.base_price
        case 'rating':
          return b.rating - a.rating
        case 'ending-soon':
          return new Date(a.sale_end_date).getTime() - new Date(b.sale_end_date).getTime()
        default:
          return b.discount_percentage - a.discount_percentage
      }
    })

    // Simulate API delay
    setTimeout(() => {
      setProducts(sortedProducts)
      setLoading(false)
    }, 500)
  }

  const categories = Array.from(new Set(products.map(p => p.category)))
  const filteredProducts = filterCategory === 'all' 
    ? products 
    : products.filter(p => p.category === filterCategory)

  const calculateTimeLeft = (endDate: string) => {
    const now = new Date().getTime()
    const end = new Date(endDate).getTime()
    const timeLeft = end - now
    
    if (timeLeft <= 0) return 'Sale ended'
    
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24))
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    
    if (days > 0) return `${days}d ${hours}h left`
    return `${hours}h left`
  }

  const ProductCard = ({ product }: { product: SaleProduct }) => (
    <div className="border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 group"
         style={{ borderColor: theme.colors.glass.border }}>
      
      {/* Product Image */}
      <div className="aspect-square relative overflow-hidden"
           style={{ backgroundColor: theme.colors.background }}>
        
        {/* Sale Badge */}
        <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold z-10">
          -{product.discount_percentage}% OFF
        </div>
        
        {/* Limited Stock Badge */}
        {product.limited_stock && (
          <div className="absolute top-2 right-2 bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-bold z-10">
            LIMITED
          </div>
        )}
        
        <div className="absolute inset-0 flex items-center justify-center"
             style={{ backgroundColor: theme.colors.surface }}>
          <div className="text-center p-4">
            <div className="text-4xl mb-2" style={{ color: theme.colors.accent }}>
              🔥
            </div>
            <p className="text-sm font-medium" style={{ color: theme.colors.text.primary }}>
              {product.title.split(' ').slice(0, 2).join(' ')}
            </p>
          </div>
        </div>

        {/* Countdown Timer */}
        <div className="absolute bottom-2 left-2 right-2">
          <div className="bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs text-center">
            ⏰ {calculateTimeLeft(product.sale_end_date)}
          </div>
        </div>
      </div>

      {/* Product Info */}
      <div className="p-4">
        <h3 className="font-semibold mb-1 line-clamp-2" style={{ color: theme.colors.text.primary }}>
          <I18nText text={product.title} />
        </h3>
        
        <p className="text-sm mb-2" style={{ color: theme.colors.text.secondary }}>
          by {product.brand}
        </p>

        {/* Rating */}
        <div className="flex items-center gap-1 mb-3">
          <div className="flex">
            {[1, 2, 3, 4, 5].map(star => (
              <span 
                key={star}
                className="text-sm"
                style={{ color: star <= product.rating ? theme.colors.accent : theme.colors.text.secondary }}
              >
                ★
              </span>
            ))}
          </div>
          <span className="text-xs" style={{ color: theme.colors.text.secondary }}>
            ({product.review_count})
          </span>
        </div>

        {/* Price */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-lg" style={{ color: theme.colors.accent }}>
              {/* Was: <Price amount={product.base_price} /> */}
              <Price amountUSD={Number(product.base_price)} rates={rates ?? undefined} />
            </span>
            <span className="text-sm line-through" style={{ color: theme.colors.text.secondary }}>
              {/* Was: <Price amount={product.compare_at_price} /> */}
              <Price amountUSD={Number(product.compare_at_price)} rates={rates ?? undefined} />
            </span>
          </div>
          <p className="text-xs font-medium text-green-600">
            You save <Price amountUSD={Number(product.compare_at_price - product.base_price)} rates={rates ?? undefined} />!
          </p>
        </div>

        {/* View Button */}
        <Link
          href={`/products/${product.slug}`}
          className="w-full py-2 rounded-lg font-medium text-center block transition-all hover:opacity-90 group-hover:scale-[1.02]"
          style={{
            backgroundColor: theme.colors.accent,
            color: brand === 'primediscreet' ? theme.colors.background : 'white'
          }}
        >
          Shop Sale Price
        </Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.colors.background }}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: theme.colors.text.primary }}>
            🔥 {brand === 'primediscreet' ? 'Elite Sale Event' : 'Special Sale Offers'}
          </h1>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: theme.colors.text.secondary }}>
            {brand === 'primediscreet' 
              ? 'Exclusive savings on luxury products - limited time offers for our elite community.'
              : 'Amazing deals on premium products - limited time offers with free discrete shipping.'
            }
          </p>
        </div>

        {/* Sale Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="text-center p-6 border rounded-lg"
               style={{ borderColor: theme.colors.glass.border }}>
            <div className="text-2xl font-bold text-red-500 mb-2">
              Up to {Math.max(...products.map(p => p.discount_percentage))}% OFF
            </div>
            <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
              Maximum savings
            </p>
          </div>
          <div className="text-center p-6 border rounded-lg"
               style={{ borderColor: theme.colors.glass.border }}>
            <div className="text-2xl font-bold mb-2" style={{ color: theme.colors.accent }}>
              {products.length}
            </div>
            <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
              Products on sale
            </p>
          </div>
          <div className="text-center p-6 border rounded-lg"
               style={{ borderColor: theme.colors.glass.border }}>
            <div className="text-2xl font-bold text-orange-500 mb-2">
              {products.filter(p => p.limited_stock).length}
            </div>
            <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
              Limited stock items
            </p>
          </div>
        </div>

        {/* Filters and Sorting */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium" style={{ color: theme.colors.text.secondary }}>
              Category:
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.glass.border,
                color: theme.colors.text.primary
              }}
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium" style={{ color: theme.colors.text.secondary }}>
              Sort by:
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.glass.border,
                color: theme.colors.text.primary
              }}
            >
              <option value="discount">Highest Discount</option>
              <option value="savings">Biggest Savings</option>
              <option value="ending-soon">Ending Soon</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, index) => (
              <div key={index} className="border rounded-lg overflow-hidden animate-pulse"
                   style={{ borderColor: theme.colors.glass.border }}>
                <div className="aspect-square" style={{ backgroundColor: theme.colors.surface }}></div>
                <div className="p-4 space-y-3">
                  <div className="h-4 rounded" style={{ backgroundColor: theme.colors.surface }}></div>
                  <div className="h-3 rounded w-2/3" style={{ backgroundColor: theme.colors.surface }}></div>
                  <div className="h-6 rounded w-1/3" style={{ backgroundColor: theme.colors.surface }}></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* Sale Benefits */}
        <div className="mt-16">
          <div className="border rounded-lg p-8 text-center"
               style={{ 
                 borderColor: theme.colors.glass.border,
                 background: `linear-gradient(135deg, ${theme.colors.surface}80, ${theme.colors.background})`
               }}>
            <h2 className="text-2xl font-bold mb-6" style={{ color: theme.colors.text.primary }}>
              {brand === 'primediscreet' ? 'Elite Sale Benefits' : 'Sale Benefits'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: '🚚',
                  title: 'Free Shipping',
                  description: 'Free discrete shipping on all sale items'
                },
                {
                  icon: '🔒',
                  title: 'Privacy Guaranteed',
                  description: 'Plain packaging and secure checkout'
                },
                {
                  icon: '↩️',
                  title: 'Easy Returns',
                  description: '30-day return policy on all purchases'
                }
              ].map((benefit, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl mb-3">{benefit.icon}</div>
                  <h3 className="font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
                    {benefit.title}
                  </h3>
                  <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
                    {benefit.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Results Summary */}
        {!loading && (
          <div className="mt-8 text-center">
            <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
              Showing {filteredProducts.length} sale items
              {filterCategory !== 'all' && ` in ${filterCategory}`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
