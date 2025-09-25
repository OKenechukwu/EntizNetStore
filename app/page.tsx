'use client'

import { useState, useEffect } from 'react'
import { useBrand } from '@/components/BrandProvider'
import { useAuth } from '@/components/AuthProvider'
import { useTranslation } from '@/hooks/useTranslation'
import HeroSlider from '@/components/hero/HeroSlider'
import ProductSearchBar from '@/components/search/ProductSearchBar'
import SideVideoAd from '@/components/ads/SideVideoAd'
import { convertFromBase, getFxRates, DEFAULT_CURRENCY } from '@/lib/currency'
import { formatPrice } from '@/lib/format'
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
  const { t } = useTranslation()
  const [featuredProducts, setFeaturedProducts] = useState<DemoProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [userCurrency, setUserCurrency] = useState(DEFAULT_CURRENCY)
  const [rates, setRates] = useState<Record<string, number>>({})

  useEffect(() => {
    // Load demo products for the home page
    loadDemoProducts()
    
    // Load currency preference
    loadCurrencyPreference()
    
    // Load FX rates
    loadFxRates()
  }, [brand])

  const loadCurrencyPreference = () => {
    if (typeof window !== 'undefined') {
      const cookieValue = document.cookie
        .split('; ')
        .find((row) => row.startsWith('currency='))
        ?.split('=')[1]
      
      if (cookieValue) {
        setUserCurrency(cookieValue.toUpperCase())
      }
    }
  }

  const loadFxRates = async () => {
    try {
      const response = await fetch('/api/fx')
      if (response.ok) {
        const data = await response.json()
        setRates(data.rates || {})
      }
    } catch (error) {
      console.error('Failed to fetch FX rates:', error)
    }
  }

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
    <div className="luxury-hover glass-morphism rounded-xl overflow-hidden border group luxury-border"
         style={{ 
           borderColor: theme.colors.glass.border,
           backgroundColor: theme.colors.surface
         }}>
      
      {/* Product Image */}
      <div className="aspect-square relative overflow-hidden">
        {product.on_sale && (
          <div className="absolute top-3 left-3 bg-brandPink text-white px-3 py-1 rounded-full text-xs font-bold z-10 shadow-lg">
            SALE
          </div>
        )}
        
        <div className="absolute inset-0 flex items-center justify-center"
             style={{ backgroundColor: theme.colors.background }}>
          <div className="text-center p-4 group-hover:scale-110 transition-transform duration-300">
            <div className="text-4xl mb-2" style={{ color: theme.colors.accent }}>
              {brand === 'primediscreet' ? '💎' : '✨'}
            </div>
            <p className="text-sm font-medium" style={{ color: theme.colors.text.primary }}>
              {product.title.split(' ').slice(0, 2).join(' ')}
            </p>
          </div>
        </div>
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      </div>

      {/* Product Info */}
      <div className="p-4 lg:p-5">
        <h3 className="font-semibold mb-1 line-clamp-2 group-hover:text-brandPink transition-colors" 
            style={{ color: theme.colors.text.primary }}>
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
                style={{ color: star <= product.rating ? '#FFD700' : theme.colors.text.secondary }}
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
            {formatPrice(convertFromBase(product.base_price, userCurrency, rates), userCurrency)}
          </span>
          {product.compare_at_price && (
            <span className="text-sm line-through" style={{ color: theme.colors.text.secondary }}>
              {formatPrice(convertFromBase(product.compare_at_price, userCurrency, rates), userCurrency)}
            </span>
          )}
        </div>

        {/* View Button */}
        <Link
          href={`/products/${product.slug}`}
          className="w-full py-3 bg-brandPink hover:bg-brandPink-600 text-white rounded-lg font-medium text-center block transition-all duration-300 hover:shadow-lg transform hover:scale-105"
        >
          {t('addToCart')}
        </Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.colors.background }}>
      
      {/* Hero Slider Section */}
      <section className="px-4 sm:px-6 lg:px-8 pt-4 pb-8">
        <div className="max-w-7xl mx-auto">
          <HeroSlider />
        </div>
      </section>

      {/* Product Search Section */}
      <section className="px-4 sm:px-6 lg:px-8 pb-12">
        <div className="max-w-7xl mx-auto">
          <ProductSearchBar 
            placeholder={brand === 'primediscreet' 
              ? "Discover exclusive luxury products..." 
              : "What are you looking for today?"
            }
          />
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        
        {/* Layout with Side Ad */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Content */}
          <div className="lg:col-span-9 space-y-16">
            {/* Categories Section */}
            <section>
              <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center lg:text-left"
                  style={{ color: theme.colors.text.primary }}>
                {t('categories')}
              </h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {categories.map((category) => (
                  <Link
                    key={category.slug}
                    href={`/categories/${category.slug}`}
                    className="luxury-hover glass-morphism p-4 lg:p-6 rounded-xl text-center group luxury-border luxury-gradient"
                    style={{ 
                      borderColor: theme.colors.glass.border,
                      backgroundColor: theme.colors.surface
                    }}
                  >
                    <div className="text-2xl lg:text-3xl mb-3 group-hover:scale-110 transition-transform luxury-float">
                      {category.icon}
                    </div>
                    <h3 className="font-medium text-xs lg:text-sm group-hover:text-brandPink transition-colors luxury-text-shadow"
                        style={{ color: theme.colors.text.primary }}>
                      {category.name}
                    </h3>
                  </Link>
                ))}
              </div>
            </section>

            {/* Featured Products */}
            <section>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                <h2 className="text-2xl md:text-3xl font-bold"
                    style={{ color: theme.colors.text.primary }}>
                  Featured Products
                </h2>
                <Link
                  href="/store"
                  className="text-sm font-medium hover:opacity-80 transition-opacity inline-flex items-center gap-1"
                  style={{ color: theme.colors.accent }}
                >
                  {t('browseProducts')}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
              
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(3)].map((_, index) => (
                    <div key={index} className="border rounded-xl overflow-hidden animate-pulse"
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {featuredProducts.slice(0, 3).map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </section>
          </div>
          
          {/* Side Ad (Desktop Only) */}
          <div className="hidden lg:block lg:col-span-3">
            <div className="sticky top-8">
              <SideVideoAd
                type="image"
                src="/images/ads/luxury-wellness.jpg"
                title="Luxury Wellness Experience"
                caption="Discover our premium collection of wellness products designed for ultimate relaxation and pleasure."
                ctaLabel="Explore Collection"
                href="/collections/wellness"
                className="mb-6"
              />
              
              <SideVideoAd
                type="video"
                src="/videos/ads/premium-showcase.mp4"
                poster="/images/ads/premium-poster.jpg"
                title="Premium Adult Collection"
                caption="Experience the finest in adult wellness with our curated selection of luxury products."
                ctaLabel="Shop Premium"
                href="/collections/premium"
                duration={20}
              />
            </div>
          </div>
        </div>

        {/* Features Section */}
        <section className="text-center mt-20">
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
              <div key={index} className="p-6 rounded-xl border hover:shadow-lg transition-all duration-300"
                   style={{ 
                     borderColor: theme.colors.glass.border,
                     backgroundColor: theme.colors.surface
                   }}>
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