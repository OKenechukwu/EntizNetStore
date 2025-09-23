'use client'

import { useState, useEffect } from 'react'
import { useBrand } from '@/components/BrandProvider'
import Link from 'next/link'

interface PopularProduct {
  id: string
  title: string
  slug: string
  base_price: number
  compare_at_price?: number
  category: string
  brand: string
  rating: number
  review_count: number
  views: number
  sales: number
  trending: boolean
}

export default function PopularPage() {
  const { theme, brand } = useBrand()
  const [products, setProducts] = useState<PopularProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('popularity')
  const [timeFrame, setTimeFrame] = useState('week')

  useEffect(() => {
    loadPopularProducts()
  }, [brand, sortBy, timeFrame])

  const loadPopularProducts = async () => {
    setLoading(true)
    
    // Demo popular products based on brand
    const demoProducts: PopularProduct[] = brand === 'primediscreet' ? [
      {
        id: '1', title: 'Elite Platinum Collection Set', slug: 'elite-platinum-collection',
        base_price: 299.99, compare_at_price: 399.99, category: 'Premium Collections',
        brand: 'Platinum Elite', rating: 4.9, review_count: 127,
        views: 2847, sales: 89, trending: true
      },
      {
        id: '2', title: 'Artisan Crystal Massage Wand', slug: 'artisan-crystal-wand',
        base_price: 189.99, category: 'Luxury Wellness', brand: 'Crystal Artisans',
        rating: 4.8, review_count: 93, views: 1923, sales: 67, trending: true
      },
      {
        id: '3', title: 'Designer Silk Collection', slug: 'designer-silk-collection',
        base_price: 149.99, compare_at_price: 199.99, category: 'Designer Lingerie',
        brand: 'Silk Dreams', rating: 4.7, review_count: 156, views: 1654, sales: 78, trending: false
      },
      {
        id: '4', title: 'Handcrafted Gold Collection', slug: 'handcrafted-gold-collection',
        base_price: 399.99, category: 'Artisan Crafted', brand: 'Gold Artisans',
        rating: 5.0, review_count: 67, views: 1432, sales: 45, trending: true
      },
      {
        id: '5', title: 'Premium Couple\'s Experience Kit', slug: 'premium-couples-kit',
        base_price: 249.99, category: 'Couples Elite', brand: 'Intimate Elite',
        rating: 4.9, review_count: 89, views: 1245, sales: 56, trending: false
      },
      {
        id: '6', title: 'Elite Wellness Starter Set', slug: 'elite-wellness-starter',
        base_price: 179.99, compare_at_price: 229.99, category: 'Luxury Wellness',
        brand: 'Elite Wellness', rating: 4.6, review_count: 201, views: 1123, sales: 82, trending: false
      }
    ] : [
      {
        id: '1', title: 'Starter Wellness Kit', slug: 'starter-wellness-kit',
        base_price: 79.99, compare_at_price: 99.99, category: 'Wellness',
        brand: 'EntizCare', rating: 4.6, review_count: 234, views: 3456, sales: 156, trending: true
      },
      {
        id: '2', title: 'Comfort Massage Collection', slug: 'comfort-massage-collection',
        base_price: 129.99, category: 'Massage & Relaxation', brand: 'ComfortZone',
        rating: 4.5, review_count: 178, views: 2876, sales: 134, trending: true
      },
      {
        id: '3', title: 'Couples Starter Set', slug: 'couples-starter-set',
        base_price: 149.99, category: 'Couples', brand: 'Together+',
        rating: 4.7, review_count: 156, views: 2345, sales: 89, trending: false
      },
      {
        id: '4', title: 'Wellness Journey Kit', slug: 'wellness-journey-kit',
        base_price: 199.99, compare_at_price: 249.99, category: 'Wellness',
        brand: 'Journey+', rating: 4.8, review_count: 98, views: 2123, sales: 67, trending: true
      },
      {
        id: '5', title: 'Essential Care Bundle', slug: 'essential-care-bundle',
        base_price: 59.99, compare_at_price: 79.99, category: 'Essentials',
        brand: 'EntizCare', rating: 4.4, review_count: 312, views: 1987, sales: 203, trending: false
      },
      {
        id: '6', title: 'Personal Care Essentials', slug: 'personal-care-essentials',
        base_price: 89.99, category: 'Personal Care', brand: 'CareFirst',
        rating: 4.3, review_count: 145, views: 1765, sales: 98, trending: false
      }
    ]

    // Sort products based on sortBy criteria
    const sortedProducts = [...demoProducts].sort((a, b) => {
      switch (sortBy) {
        case 'views':
          return b.views - a.views
        case 'sales':
          return b.sales - a.sales
        case 'rating':
          return b.rating - a.rating
        case 'price-low':
          return a.base_price - b.base_price
        case 'price-high':
          return b.base_price - a.base_price
        default: // popularity
          return (b.views * 0.3 + b.sales * 0.7) - (a.views * 0.3 + a.sales * 0.7)
      }
    })

    // Simulate API delay
    setTimeout(() => {
      setProducts(sortedProducts)
      setLoading(false)
    }, 500)
  }

  const ProductCard = ({ product }: { product: PopularProduct }) => (
    <div className="border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 group"
         style={{ borderColor: theme.colors.glass.border }}>
      
      {/* Product Image */}
      <div className="aspect-square relative overflow-hidden"
           style={{ backgroundColor: theme.colors.background }}>
        
        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
          {product.trending && (
            <div className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold">
              🔥 TRENDING
            </div>
          )}
          {product.compare_at_price && (
            <div className="bg-green-600 text-white px-2 py-1 rounded-full text-xs font-bold">
              SALE
            </div>
          )}
        </div>
        
        <div className="absolute inset-0 flex items-center justify-center"
             style={{ backgroundColor: theme.colors.surface }}>
          <div className="text-center p-4">
            <div className="text-4xl mb-2" style={{ color: theme.colors.accent }}>
              {brand === 'primediscreet' ? '💎' : '⭐'}
            </div>
            <p className="text-sm font-medium" style={{ color: theme.colors.text.primary }}>
              {product.title.split(' ').slice(0, 2).join(' ')}
            </p>
          </div>
        </div>

        {/* Popularity Rank */}
        <div className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
             style={{ 
               backgroundColor: theme.colors.accent,
               color: brand === 'primediscreet' ? theme.colors.background : 'white'
             }}>
          #{products.findIndex(p => p.id === product.id) + 1}
        </div>
      </div>

      {/* Product Info */}
      <div className="p-4">
        <h3 className="font-semibold mb-1 line-clamp-2" style={{ color: theme.colors.text.primary }}>
          {product.title}
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

        {/* Popularity Stats */}
        <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
          <div className="text-center p-2 rounded"
               style={{ backgroundColor: theme.colors.background }}>
            <p className="font-semibold" style={{ color: theme.colors.text.primary }}>
              {product.views.toLocaleString()}
            </p>
            <p style={{ color: theme.colors.text.secondary }}>Views</p>
          </div>
          <div className="text-center p-2 rounded"
               style={{ backgroundColor: theme.colors.background }}>
            <p className="font-semibold" style={{ color: theme.colors.text.primary }}>
              {product.sales.toLocaleString()}
            </p>
            <p style={{ color: theme.colors.text.secondary }}>Sales</p>
          </div>
        </div>

        {/* Price */}
        <div className="flex items-center gap-2 mb-4">
          <span className="font-bold text-lg" style={{ color: theme.colors.accent }}>
            ${product.base_price}
          </span>
          {product.compare_at_price && (
            <span className="text-sm line-through" style={{ color: theme.colors.text.secondary }}>
              ${product.compare_at_price}
            </span>
          )}
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
          View Details
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
            {brand === 'primediscreet' ? '🔥 Trending Elite Products' : '⭐ Popular Products'}
          </h1>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: theme.colors.text.secondary }}>
            {brand === 'primediscreet' 
              ? 'Discover the most sought-after luxury products trending among our elite community.'
              : 'Discover the most popular products trending among our community of satisfied customers.'
            }
          </p>
        </div>

        {/* Filters and Sorting */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8 justify-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium" style={{ color: theme.colors.text.secondary }}>
              Time frame:
            </label>
            <select
              value={timeFrame}
              onChange={(e) => setTimeFrame(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.glass.border,
                color: theme.colors.text.primary
              }}
            >
              <option value="day">Last 24 hours</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
              <option value="year">This year</option>
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
              <option value="popularity">Overall Popularity</option>
              <option value="views">Most Viewed</option>
              <option value="sales">Best Selling</option>
              <option value="rating">Highest Rated</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
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
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* Trending Stats */}
        {!loading && (
          <div className="mt-12 text-center">
            <div className="border rounded-lg p-6 max-w-2xl mx-auto"
                 style={{ borderColor: theme.colors.glass.border }}>
              <h2 className="text-xl font-bold mb-4" style={{ color: theme.colors.text.primary }}>
                {brand === 'primediscreet' ? 'Elite Community Stats' : 'Community Activity'}
              </h2>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold" style={{ color: theme.colors.accent }}>
                    {products.reduce((sum, p) => sum + p.views, 0).toLocaleString()}
                  </p>
                  <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
                    Total Views
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: theme.colors.accent }}>
                    {products.reduce((sum, p) => sum + p.sales, 0).toLocaleString()}
                  </p>
                  <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
                    Total Sales
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: theme.colors.accent }}>
                    {products.filter(p => p.trending).length}
                  </p>
                  <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
                    Trending Now
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}