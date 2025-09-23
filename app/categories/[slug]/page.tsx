'use client'

import { useState, useEffect } from 'react'
import { useBrand } from '@/components/BrandProvider'
import Link from 'next/link'

interface Product {
  id: string
  title: string
  slug: string
  price: number
  originalPrice?: number
  description: string
  category: string
  brand: string
  rating: number
  reviews: number
  onSale?: boolean
}

interface CategoryPageProps {
  params: { slug: string }
}

export default function CategoryPage({ params }: CategoryPageProps) {
  const { theme, brand } = useBrand()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('featured')

  // Category mapping
  const categoryMap: Record<string, { name: string; description: string }> = {
    'wellness': {
      name: 'Wellness & Self-Care',
      description: 'Premium wellness products for self-discovery and personal care'
    },
    'massage': {
      name: 'Massage & Relaxation',
      description: 'Professional massage tools and relaxation accessories'
    },
    'essentials': {
      name: 'Essential Care',
      description: 'Daily care essentials and must-have products'
    },
    'couples': {
      name: 'Couples & Intimacy',
      description: 'Products designed to enhance connection and intimacy'
    },
    'personal-care': {
      name: 'Personal Care',
      description: 'High-quality personal care and hygiene products'
    },
    'gift-sets': {
      name: 'Gift Sets & Bundles',
      description: 'Curated gift collections for special occasions'
    },
    'luxury': {
      name: 'Luxury Collection',
      description: 'Premium luxury products for the discerning customer'
    }
  }

  const category = categoryMap[params.slug] || { 
    name: 'Category',
    description: 'Explore our premium products'
  }

  useEffect(() => {
    loadCategoryProducts()
  }, [params.slug, brand])

  const loadCategoryProducts = async () => {
    setLoading(true)
    
    // Demo products based on category and brand
    const demoProducts: Product[] = brand === 'primediscreet' ? [
      // PrimeDiscreet products
      {
        id: '1', title: 'Elite Platinum Wellness Set', slug: 'elite-platinum-wellness',
        price: 299.99, originalPrice: 399.99, description: 'Premium wellness collection with luxury accessories',
        category: params.slug, brand: 'Platinum Elite', rating: 4.9, reviews: 127, onSale: true
      },
      {
        id: '2', title: 'Designer Silk Collection', slug: 'designer-silk-collection',
        price: 149.99, description: 'Luxurious silk accessories for intimate moments',
        category: params.slug, brand: 'Silk Dreams', rating: 4.7, reviews: 156
      },
      {
        id: '3', title: 'Artisan Crystal Set', slug: 'artisan-crystal-set',
        price: 219.99, originalPrice: 279.99, description: 'Hand-crafted crystal accessories with premium finish',
        category: params.slug, brand: 'Crystal Artisans', rating: 4.8, reviews: 89, onSale: true
      },
      {
        id: '4', title: 'Elite Couples Bundle', slug: 'elite-couples-bundle',
        price: 199.99, description: 'Sophisticated accessories for intimate connection',
        category: params.slug, brand: 'Intimate Elite', rating: 4.9, reviews: 76
      },
      {
        id: '5', title: 'Gold Anniversary Collection', slug: 'gold-anniversary-collection',
        price: 349.99, description: 'Exclusive gold-accented luxury collection',
        category: params.slug, brand: 'Gold Artisans', rating: 5.0, reviews: 45
      },
      {
        id: '6', title: 'Platinum Care Set', slug: 'platinum-care-set',
        price: 179.99, originalPrice: 229.99, description: 'Premium personal care with platinum-grade materials',
        category: params.slug, brand: 'Platinum Care', rating: 4.6, reviews: 201, onSale: true
      }
    ] : [
      // EntizNetStore products
      {
        id: '1', title: 'Wellness Starter Kit', slug: 'wellness-starter-kit',
        price: 79.99, originalPrice: 99.99, description: 'Complete wellness kit for beginners',
        category: params.slug, brand: 'EntizCare', rating: 4.6, reviews: 234, onSale: true
      },
      {
        id: '2', title: 'Essential Care Bundle', slug: 'essential-care-bundle',
        price: 59.99, description: 'Daily essentials for personal care and wellness',
        category: params.slug, brand: 'EntizCare', rating: 4.4, reviews: 312
      },
      {
        id: '3', title: 'Comfort Massage Collection', slug: 'comfort-massage-collection',
        price: 109.99, originalPrice: 149.99, description: 'Professional massage tools for home relaxation',
        category: params.slug, brand: 'ComfortZone', rating: 4.5, reviews: 145, onSale: true
      },
      {
        id: '4', title: 'Couples Communication Kit', slug: 'couples-communication-kit',
        price: 89.99, description: 'Tools and guides for better intimate communication',
        category: params.slug, brand: 'Together+', rating: 4.7, reviews: 123
      },
      {
        id: '5', title: 'Complete Care Package', slug: 'complete-care-package',
        price: 129.99, description: 'Comprehensive personal care solution',
        category: params.slug, brand: 'CareFirst', rating: 4.3, reviews: 89
      },
      {
        id: '6', title: 'Wellness Journey Kit', slug: 'wellness-journey-kit',
        price: 199.99, description: 'Advanced wellness products for experienced users',
        category: params.slug, brand: 'Journey+', rating: 4.8, reviews: 98
      }
    ]

    // Simulate API delay
    setTimeout(() => {
      setProducts(demoProducts)
      setLoading(false)
    }, 500)
  }

  const sortedProducts = [...products].sort((a, b) => {
    switch (sortBy) {
      case 'price-low':
        return a.price - b.price
      case 'price-high':
        return b.price - a.price
      case 'rating':
        return b.rating - a.rating
      case 'newest':
        return b.id.localeCompare(a.id)
      default:
        return 0
    }
  })

  const ProductCard = ({ product }: { product: Product }) => (
    <div className="border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 group"
         style={{ borderColor: theme.colors.glass.border }}>
      
      {/* Product Image */}
      <div className="aspect-square relative overflow-hidden"
           style={{ backgroundColor: theme.colors.surface }}>
        
        {/* Sale Badge */}
        {product.onSale && (
          <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold z-10">
            SALE
          </div>
        )}
        
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center p-4">
            <div className="text-3xl mb-2" style={{ color: theme.colors.accent }}>
              {params.slug === 'wellness' ? '🧘' :
               params.slug === 'massage' ? '💆' :
               params.slug === 'essentials' ? '✨' :
               params.slug === 'couples' ? '💕' :
               params.slug === 'personal-care' ? '🌿' :
               params.slug === 'gift-sets' ? '🎁' : '💎'}
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

        <p className="text-xs mb-3 line-clamp-2" style={{ color: theme.colors.text.secondary }}>
          {product.description}
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
            ({product.reviews})
          </span>
        </div>

        {/* Price */}
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg" style={{ color: theme.colors.accent }}>
              ${product.price}
            </span>
            {product.originalPrice && (
              <span className="text-sm line-through" style={{ color: theme.colors.text.secondary }}>
                ${product.originalPrice}
              </span>
            )}
          </div>
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
        
        {/* Breadcrumb */}
        <nav className="text-sm mb-6">
          <Link href="/" className="hover:opacity-70 transition-colors" style={{ color: theme.colors.text.secondary }}>
            Home
          </Link>
          <span className="mx-2" style={{ color: theme.colors.text.secondary }}>→</span>
          <Link href="/categories" className="hover:opacity-70 transition-colors" style={{ color: theme.colors.text.secondary }}>
            Categories
          </Link>
          <span className="mx-2" style={{ color: theme.colors.text.secondary }}>→</span>
          <span style={{ color: theme.colors.accent }}>{category.name}</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: theme.colors.text.primary }}>
            {category.name}
          </h1>
          <p className="text-lg max-w-2xl" style={{ color: theme.colors.text.secondary }}>
            {category.description}
          </p>
        </div>

        {/* Filters and Sorting */}
        <div className="flex items-center justify-between mb-8">
          <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
            {loading ? 'Loading...' : `${products.length} products found`}
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sortedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* Back to Categories */}
        <div className="mt-12 text-center">
          <Link 
            href="/categories"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all hover:opacity-90"
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.glass.border,
              color: theme.colors.text.primary,
              border: `1px solid ${theme.colors.glass.border}`
            }}
          >
            ← Browse Other Categories
          </Link>
        </div>
      </div>
    </div>
  )
}