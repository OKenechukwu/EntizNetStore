'use client'

import { useState, useEffect } from 'react'
import { useBrand } from '@/components/BrandProvider'
import Link from 'next/link'

interface DemoProduct {
  id: string
  title: string
  slug: string
  base_price: number
  compare_at_price?: number
  category: string
  brand: string
  rating: number
  review_count: number
  on_sale?: boolean
  tags: string[]
}

interface DemoCategory {
  id: string
  name: string
  slug: string
  description: string
}

export default function StorePage() {
  const { theme, brand } = useBrand()
  const [products, setProducts] = useState<DemoProduct[]>([])
  const [categories, setCategories] = useState<DemoCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('featured')
  const [filterCategory, setFilterCategory] = useState('all')

  useEffect(() => {
    loadStoreData()
  }, [brand])

  const loadStoreData = async () => {
    setLoading(true)
    
    // Demo categories based on brand
    const demoCategories: DemoCategory[] = brand === 'primediscreet' ? [
      { id: '1', name: 'Premium Collections', slug: 'premium-collections', description: 'Exclusive luxury sets' },
      { id: '2', name: 'Luxury Wellness', slug: 'luxury-wellness', description: 'Premium wellness products' },
      { id: '3', name: 'Designer Lingerie', slug: 'designer-lingerie', description: 'High-end intimate apparel' },
      { id: '4', name: 'Couples Elite', slug: 'couples-elite', description: 'Exclusive couples products' },
      { id: '5', name: 'Artisan Crafted', slug: 'artisan-crafted', description: 'Handcrafted luxury items' }
    ] : [
      { id: '1', name: 'Wellness', slug: 'wellness', description: 'Personal wellness products' },
      { id: '2', name: 'Massage & Relaxation', slug: 'massage', description: 'Massage and relaxation items' },
      { id: '3', name: 'Essentials', slug: 'essentials', description: 'Essential care products' },
      { id: '4', name: 'Couples', slug: 'couples', description: 'Products for couples' },
      { id: '5', name: 'Personal Care', slug: 'personal-care', description: 'Personal care essentials' }
    ]

    // Demo products based on brand
    const demoProducts: DemoProduct[] = brand === 'primediscreet' ? [
      {
        id: '1', title: 'Elite Platinum Collection Set', slug: 'elite-platinum-collection',
        base_price: 299.99, compare_at_price: 399.99, category: 'Premium Collections',
        brand: 'Platinum Elite', rating: 4.9, review_count: 127, on_sale: true,
        tags: ['premium', 'collection', 'platinum']
      },
      {
        id: '2', title: 'Artisan Crystal Massage Wand', slug: 'artisan-crystal-wand',
        base_price: 189.99, category: 'Luxury Wellness', brand: 'Crystal Artisans',
        rating: 4.8, review_count: 93, tags: ['crystal', 'artisan', 'wellness']
      },
      {
        id: '3', title: 'Designer Silk Collection', slug: 'designer-silk-collection',
        base_price: 149.99, compare_at_price: 199.99, category: 'Designer Lingerie',
        brand: 'Silk Dreams', rating: 4.7, review_count: 156, on_sale: true,
        tags: ['silk', 'designer', 'luxury']
      },
      {
        id: '4', title: 'Premium Couple\'s Experience Kit', slug: 'premium-couples-kit',
        base_price: 249.99, category: 'Couples Elite', brand: 'Intimate Elite',
        rating: 4.9, review_count: 89, tags: ['couples', 'premium', 'experience']
      },
      {
        id: '5', title: 'Handcrafted Gold Collection', slug: 'handcrafted-gold-collection',
        base_price: 399.99, category: 'Artisan Crafted', brand: 'Gold Artisans',
        rating: 5.0, review_count: 67, tags: ['gold', 'handcrafted', 'exclusive']
      },
      {
        id: '6', title: 'Elite Wellness Starter Set', slug: 'elite-wellness-starter',
        base_price: 179.99, compare_at_price: 229.99, category: 'Luxury Wellness',
        brand: 'Elite Wellness', rating: 4.6, review_count: 201, on_sale: true,
        tags: ['wellness', 'starter', 'elite']
      }
    ] : [
      {
        id: '1', title: 'Starter Wellness Kit', slug: 'starter-wellness-kit',
        base_price: 79.99, compare_at_price: 99.99, category: 'Wellness',
        brand: 'EntizCare', rating: 4.6, review_count: 234, on_sale: true,
        tags: ['starter', 'wellness', 'kit']
      },
      {
        id: '2', title: 'Comfort Massage Collection', slug: 'comfort-massage-collection',
        base_price: 129.99, category: 'Massage & Relaxation', brand: 'ComfortZone',
        rating: 4.5, review_count: 178, tags: ['massage', 'comfort', 'relaxation']
      },
      {
        id: '3', title: 'Essential Care Bundle', slug: 'essential-care-bundle',
        base_price: 59.99, compare_at_price: 79.99, category: 'Essentials',
        brand: 'EntizCare', rating: 4.4, review_count: 312, on_sale: true,
        tags: ['essentials', 'care', 'bundle']
      },
      {
        id: '4', title: 'Couples Starter Set', slug: 'couples-starter-set',
        base_price: 149.99, category: 'Couples', brand: 'Together+',
        rating: 4.7, review_count: 156, tags: ['couples', 'starter', 'together']
      },
      {
        id: '5', title: 'Personal Care Essentials', slug: 'personal-care-essentials',
        base_price: 89.99, category: 'Personal Care', brand: 'CareFirst',
        rating: 4.3, review_count: 145, tags: ['personal', 'care', 'essentials']
      },
      {
        id: '6', title: 'Wellness Journey Kit', slug: 'wellness-journey-kit',
        base_price: 199.99, compare_at_price: 249.99, category: 'Wellness',
        brand: 'Journey+', rating: 4.8, review_count: 98, on_sale: true,
        tags: ['wellness', 'journey', 'complete']
      }
    ]

    // Simulate API delay
    setTimeout(() => {
      setCategories(demoCategories)
      setProducts(demoProducts)
      setLoading(false)
    }, 500)
  }

  const filteredProducts = products.filter(product => 
    filterCategory === 'all' || product.category === categories.find(c => c.slug === filterCategory)?.name
  )

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'price-low':
        return a.base_price - b.base_price
      case 'price-high':
        return b.base_price - a.base_price
      case 'rating':
        return b.rating - a.rating
      case 'newest':
        return parseInt(b.id) - parseInt(a.id)
      default:
        return 0
    }
  })

  const ProductCard = ({ product }: { product: DemoProduct }) => (
    <div className="border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300"
         style={{ borderColor: theme.colors.glass.border }}>
      
      {/* Product Image */}
      <div className="aspect-square relative overflow-hidden"
           style={{ backgroundColor: theme.colors.background }}>
        {product.on_sale && (
          <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold z-10">
            SALE
          </div>
        )}
        
        <div className="absolute inset-0 flex items-center justify-center"
             style={{ backgroundColor: theme.colors.surface }}>
          <div className="text-center p-4">
            <div className="text-4xl mb-2" style={{ color: theme.colors.accent }}>
              {brand === 'primediscreet' ? '💎' : '✨'}
            </div>
            <p className="text-sm font-medium" style={{ color: theme.colors.text.primary }}>
              {product.title.split(' ').slice(0, 2).join(' ')}
            </p>
          </div>
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

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-4">
          {product.tags.slice(0, 2).map((tag, index) => (
            <span 
              key={index}
              className="px-2 py-1 text-xs rounded-full"
              style={{ 
                backgroundColor: theme.colors.background,
                color: theme.colors.text.secondary
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* View Button */}
        <Link
          href={`/products/${product.slug}`}
          className="w-full py-2 rounded-lg font-medium text-center block transition-all hover:opacity-90"
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
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: theme.colors.text.primary }}>
            {brand === 'primediscreet' ? 'Elite Collection Store' : 'Premium Store'}
          </h1>
          <p className="text-lg" style={{ color: theme.colors.text.secondary }}>
            {brand === 'primediscreet' 
              ? 'Discover our curated collection of luxury intimate products from exclusive brands.'
              : 'Discover our curated collection of premium adult products from verified brands.'
            }
          </p>
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
                <option key={cat.id} value={cat.slug}>{cat.name}</option>
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
              <option value="featured">Featured</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
              <option value="newest">Newest First</option>
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
        ) : sortedProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sortedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="text-6xl mb-4" style={{ color: theme.colors.text.secondary }}>
              {brand === 'primediscreet' ? '💎' : '🛍️'}
            </div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
              No products found
            </h3>
            <p className="mb-6" style={{ color: theme.colors.text.secondary }}>
              Try adjusting your filters or browse all categories
            </p>
            <Link 
              href="/categories"
              className="px-6 py-3 rounded-lg font-medium transition-all hover:opacity-90"
              style={{
                backgroundColor: theme.colors.accent,
                color: brand === 'primediscreet' ? theme.colors.background : 'white'
              }}
            >
              Browse Categories
            </Link>
          </div>
        )}

        {/* Results Summary */}
        <div className="mt-8 text-center">
          <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
            Showing {sortedProducts.length} of {products.length} products
            {filterCategory !== 'all' && (
              <> in {categories.find(c => c.slug === filterCategory)?.name}</>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}