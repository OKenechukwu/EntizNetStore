'use client'

import { useBrand } from '@/components/BrandProvider'
import { getBrandClasses } from '@/lib/brand-theme'
import Link from 'next/link'

export default function PremiumCollectionPage() {
  const { brand, theme } = useBrand()
  const brandClasses = getBrandClasses(brand)
  
  const brandName = brand === 'entiznetstore' ? 'EntizNetStore' : 'PrimeDiscreet'
  const brandColor = brand === 'entiznetstore' ? 'text-amber-600' : 'text-amber-400'
  const buttonClass = brand === 'entiznetstore' 
    ? 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800' 
    : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600'

  // Premium collections data
  const collections = [
    {
      id: 'luxury-essentials',
      title: 'Luxury Essentials',
      description: 'Our core collection of premium adult wellness products',
      href: '/store?collection=luxury-essentials',
      featured: true
    },
    {
      id: 'designers-choice',
      title: "Designer's Choice",
      description: 'Artisan-crafted pieces from renowned intimate wellness designers',
      href: '/store?collection=designers-choice',
      featured: true
    },
    {
      id: 'couples-luxury',
      title: 'Couples Luxury',
      description: 'Premium products designed for intimate shared experiences',
      href: '/store?collection=couples-luxury',
      featured: true
    },
    {
      id: 'smart-collection',
      title: 'Smart & Connected',
      description: 'Cutting-edge products with app connectivity and advanced features',
      href: '/store?collection=smart-collection',
      featured: false
    },
    {
      id: 'platinum-series',
      title: 'Platinum Series',
      description: 'Our most exclusive and luxurious product line',
      href: '/store?collection=platinum-series',
      featured: false
    },
    {
      id: 'wellness-ritual',
      title: 'Wellness Ritual',
      description: 'Products designed for mindful intimacy and self-care',
      href: '/store?collection=wellness-ritual',
      featured: false
    }
  ]

  const featuredCollections = collections.filter(c => c.featured)
  const allCollections = collections

  return (
    <div className={`min-h-screen ${brandClasses.background}`}>
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className={`text-4xl md:text-6xl font-bold mb-6 ${brandColor}`}>
            Premium Collections
          </h1>
          <p className="text-xl opacity-80 max-w-3xl mx-auto mb-8" style={{ color: theme.colors.text.secondary }}>
            Explore our carefully curated collections of luxury adult wellness products, 
            each designed to elevate your intimate experiences
          </p>
          <Link 
            href="/store"
            className={`inline-block px-8 py-4 ${buttonClass} text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105`}
          >
            Shop All Products
          </Link>
        </div>

        {/* Featured Collections */}
        <div className="mb-16">
          <h2 className={`text-3xl font-bold mb-8 ${brandColor}`}>Featured Collections</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {featuredCollections.map((collection) => (
              <Link 
                key={collection.id}
                href={collection.href}
                className={`group block p-6 rounded-xl ${brandClasses.surface} hover:scale-105 transition-all duration-300`}
              >
                <div className={`h-48 bg-gradient-to-br ${brandColor.replace('text-', 'from-')} ${brandColor.replace('text-', 'to-')}-800 rounded-lg mb-6 flex items-center justify-center`}>
                  <span className="text-white text-lg font-semibold">Coming Soon</span>
                </div>
                <h3 className={`text-xl font-bold mb-3 ${brandColor} group-hover:text-opacity-80`}>
                  {collection.title}
                </h3>
                <p style={{ color: theme.colors.text.secondary }} className="mb-4">{collection.description}</p>
                <span className={`text-sm ${brandColor} opacity-60`}>Explore Collection →</span>
              </Link>
            ))}
          </div>
        </div>

        {/* All Collections Grid */}
        <div className="mb-16">
          <h2 className={`text-3xl font-bold mb-8 ${brandColor}`}>All Premium Collections</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allCollections.map((collection) => (
              <Link 
                key={collection.id}
                href={collection.href}
                className={`group block p-6 rounded-xl ${brandClasses.surface} hover:scale-105 transition-all duration-300`}
              >
                <div className={`h-32 bg-gradient-to-br ${brandColor.replace('text-', 'from-')} ${brandColor.replace('text-', 'to-')}-800 bg-opacity-20 rounded-lg mb-4 flex items-center justify-center`}>
                  <svg className={`w-8 h-8 ${brandColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <h3 className={`text-lg font-bold mb-2 ${brandColor} group-hover:text-opacity-80`}>
                  {collection.title}
                </h3>
                <p className="text-sm mb-3" style={{ color: theme.colors.text.secondary }}>{collection.description}</p>
                <span className={`text-xs ${brandColor} opacity-60`}>View Collection →</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <h2 className={`text-2xl font-bold mb-4 ${brandColor}`}>Ready to Explore?</h2>
          <p className="text-lg opacity-80 mb-8" style={{ color: theme.colors.text.secondary }}>
            Discover your perfect collection and elevate your intimate experiences
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/store"
              className={`px-8 py-4 ${buttonClass} text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105`}
            >
              Shop All Products
            </Link>
            <Link 
              href="/categories"
              className={`px-8 py-4 border-2 ${brandColor.replace('text-', 'border-')} ${brandColor} font-semibold rounded-lg transition-all duration-300 hover:bg-opacity-10 ${brandColor.replace('text-', 'hover:bg-')}`}
            >
              Browse Categories
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}