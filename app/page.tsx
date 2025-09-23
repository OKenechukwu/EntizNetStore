'use client'

import { useState, useEffect } from 'react'
import { useBrand } from '@/components/BrandProvider'
import { useAuth } from '@/components/AuthProvider'
import Link from 'next/link'

interface DemoProduct {
  id: string
  title: string
  slug: string
  base_price: number
  compare_at_price?: number
  image_url?: string
  category: string
  brand: string
  rating: number
  review_count: number
  on_sale?: boolean
}

export default function Home() {
  const { theme, brand } = useBrand()
  const { user } = useAuth()
  const [featuredProducts, setFeaturedProducts] = useState<DemoProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load demo products for the home page
    loadDemoProducts()
  }, [brand])

  const loadDemoProducts = async () => {
    setLoading(true)
    
    // Demo products based on brand
    const demoProducts: DemoProduct[] = brand === 'primediscreet' ? [
      {
        id: '1',
        title: 'Elite Platinum Collection Set',
        slug: 'elite-platinum-collection',
        base_price: 299.99,
        compare_at_price: 399.99,
        category: 'Premium Collections',
        brand: 'Platinum Elite',
        rating: 4.9,
        review_count: 127,
        on_sale: true
      },
      {
        id: '2', 
        title: 'Artisan Crystal Massage Wand',
        slug: 'artisan-crystal-wand',
        base_price: 189.99,
        category: 'Luxury Wellness',
        brand: 'Crystal Artisans',
        rating: 4.8,
        review_count: 93
      },
      {
        id: '3',
        title: 'Designer Silk Collection',
        slug: 'designer-silk-collection',
        base_price: 149.99,
        compare_at_price: 199.99,
        category: 'Luxury Lingerie',
        brand: 'Silk Dreams',
        rating: 4.7,
        review_count: 156,
        on_sale: true
      },
      {
        id: '4',
        title: 'Premium Couple\'s Experience Kit',
        slug: 'premium-couples-kit',
        base_price: 249.99,
        category: 'Couples Collections',
        brand: 'Intimate Elite',
        rating: 4.9,
        review_count: 89
      }
    ] : [
      {
        id: '1',
        title: 'Starter Wellness Kit',
        slug: 'starter-wellness-kit',
        base_price: 79.99,
        compare_at_price: 99.99,
        category: 'Wellness',
        brand: 'EntizCare',
        rating: 4.6,
        review_count: 234,
        on_sale: true
      },
      {
        id: '2',
        title: 'Comfort Massage Collection',
        slug: 'comfort-massage-collection',
        base_price: 129.99,
        category: 'Massage & Wellness',
        brand: 'ComfortZone',
        rating: 4.5,
        review_count: 178
      },
      {
        id: '3',
        title: 'Essential Care Bundle',
        slug: 'essential-care-bundle',
        base_price: 59.99,
        compare_at_price: 79.99,
        category: 'Essentials',
        brand: 'EntizCare',
        rating: 4.4,
        review_count: 312,
        on_sale: true
      },
      {
        id: '4',
        title: 'Couples Starter Set',
        slug: 'couples-starter-set',
        base_price: 149.99,
        category: 'Couples',
        brand: 'Together+',
        rating: 4.7,
        review_count: 156
      }
    ]

    // Simulate API call delay
    setTimeout(() => {
      setFeaturedProducts(demoProducts)
      setLoading(false)
    }, 500)
  }

  const categories = brand === 'primediscreet' ? [
    { name: 'Premium Collections', icon: '💎', slug: 'premium-collections' },
    { name: 'Luxury Wellness', icon: '✨', slug: 'luxury-wellness' },
    { name: 'Designer Lingerie', icon: '👗', slug: 'designer-lingerie' },
    { name: 'Couples Elite', icon: '💫', slug: 'couples-elite' },
    { name: 'Artisan Crafted', icon: '🎨', slug: 'artisan-crafted' },
    { name: 'Exclusive Collections', icon: '🔐', slug: 'exclusive-collections' }
  ] : [
    { name: 'Wellness', icon: '🌿', slug: 'wellness' },
    { name: 'Massage', icon: '💆', slug: 'massage' },
    { name: 'Essentials', icon: '🛍️', slug: 'essentials' },
    { name: 'Couples', icon: '💕', slug: 'couples' },
    { name: 'Personal Care', icon: '🧴', slug: 'personal-care' },
    { name: 'Gift Sets', icon: '🎁', slug: 'gift-sets' }
  ]

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
      
      {/* Hero Section */}
      <section className="relative py-20 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 opacity-5"
             style={{ 
               background: `radial-gradient(circle at 30% 70%, ${theme.colors.accent} 0%, transparent 50%),
                           radial-gradient(circle at 70% 30%, ${theme.colors.accent} 0%, transparent 50%)`
             }}>
        </div>
        
        <div className="relative max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold mb-6"
              style={{ color: theme.colors.text.primary }}>
            {brand === 'primediscreet' ? (
              <>Elite <span style={{ color: theme.colors.accent }}>Intimate</span> Collection</>
            ) : (
              <>Premium <span style={{ color: theme.colors.accent }}>Adult</span> Marketplace</>
            )}
          </h1>
          
          <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto"
             style={{ color: theme.colors.text.secondary }}>
            {brand === 'primediscreet' 
              ? 'Discover our exclusive collection of luxury intimate products, curated for discerning individuals who value quality and discretion.'
              : 'Your trusted destination for premium adult wellness products with discrete shipping and exceptional customer service.'
            }
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/store"
              className="px-8 py-3 rounded-lg font-semibold transition-all hover:opacity-90"
              style={{
                backgroundColor: theme.colors.accent,
                color: brand === 'primediscreet' ? theme.colors.background : 'white'
              }}
            >
              Explore Collection
            </Link>
            <Link
              href="/categories"
              className="px-8 py-3 rounded-lg font-semibold border transition-all hover:opacity-80"
              style={{
                borderColor: theme.colors.accent,
                color: theme.colors.accent
              }}
            >
              Browse Categories
            </Link>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 pb-20">
        
        {/* Categories Section */}
        <section className="mb-16">
          <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center"
              style={{ color: theme.colors.text.primary }}>
            Shop by Category
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`/categories/${category.slug}`}
                className="p-6 border rounded-lg text-center hover:shadow-md transition-all group"
                style={{ borderColor: theme.colors.glass.border }}
              >
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">
                  {category.icon}
                </div>
                <h3 className="font-medium text-sm group-hover:opacity-80 transition-opacity"
                    style={{ color: theme.colors.text.primary }}>
                  {category.name}
                </h3>
              </Link>
            ))}
          </div>
        </section>

        {/* Featured Products */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-bold"
                style={{ color: theme.colors.text.primary }}>
              Featured Products
            </h2>
            <Link
              href="/store"
              className="text-sm font-medium hover:opacity-80 transition-opacity"
              style={{ color: theme.colors.accent }}
            >
              View All →
            </Link>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, index) => (
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>

        {/* Features Section */}
        <section className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-12"
              style={{ color: theme.colors.text.primary }}>
            Why Choose {brand === 'primediscreet' ? 'Elite Collection' : 'EntizNetStore'}?
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: '🔒',
                title: 'Discrete Shipping',
                description: 'All orders shipped in plain packaging with complete privacy'
              },
              {
                icon: brand === 'primediscreet' ? '💎' : '⭐',
                title: brand === 'primediscreet' ? 'Premium Quality' : 'Trusted Brands',
                description: brand === 'primediscreet' 
                  ? 'Handpicked luxury products from exclusive artisan creators'
                  : 'Carefully curated products from verified and trusted manufacturers'
              },
              {
                icon: '🚚',
                title: 'Fast Delivery',
                description: 'Quick and reliable shipping with tracking information provided'
              }
            ].map((feature, index) => (
              <div key={index} className="p-6">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-3" style={{ color: theme.colors.text.primary }}>
                  {feature.title}
                </h3>
                <p style={{ color: theme.colors.text.secondary }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}