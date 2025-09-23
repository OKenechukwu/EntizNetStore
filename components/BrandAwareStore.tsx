'use client'

import { useBrand } from '@/components/BrandProvider'
import { getBrandCategories, getBrandPricingTiers, getBrandTags } from '@/lib/product-filters'
import { getBrandClasses } from '@/lib/brand-theme'
import Link from 'next/link'

export default function BrandAwareStore() {
  const { brand, config, theme } = useBrand()
  const brandClasses = getBrandClasses(brand)
  const categories = getBrandCategories(brand)
  const pricingTiers = getBrandPricingTiers(brand)
  const featuredTags = getBrandTags(brand)

  return (
    <div className={`min-h-screen transition-all duration-500 ${brandClasses.background}`}>
      {/* Brand-Specific Hero Section */}
      <div className={`${brandClasses.surface} border-b transition-all duration-500`} 
           style={{ borderColor: theme.colors.glass.border }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className={`font-serif text-5xl font-bold mb-4 transition-colors ${brandClasses.text.primary}`}>
            {config.name}
          </h1>
          <p className={`text-xl mb-8 transition-colors ${brandClasses.text.secondary}`}>
            {config.tagline}
          </p>
          <p className={`text-lg max-w-2xl mx-auto mb-12 transition-colors ${brandClasses.text.secondary}`}>
            {config.description}
          </p>
          
          {/* Brand-Specific CTA */}
          {brand === 'primediscreet' ? (
            <div className="space-y-4">
              <button className={`px-8 py-4 rounded-lg font-medium transition-all ${brandClasses.button.primary}`}>
                Access Elite Collection
              </button>
              <p className="text-sm text-amber-200">
                Exclusive access • Ultra-premium selection • Complete discretion
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <button className={`px-8 py-4 rounded-lg font-medium transition-all ${brandClasses.button.primary}`}>
                Explore Luxury Collection
              </button>
              <p className="text-sm text-amber-600">
                Premium quality • Discrete delivery • Authentic products
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Brand-Specific Categories */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className={`text-3xl font-bold mb-8 transition-colors ${brandClasses.text.primary}`}>
          {brand === 'primediscreet' ? 'Exclusive Collections' : 'Shop by Category'}
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {categories.map((category, index) => (
            <Link 
              key={category}
              href={`/categories/${category.toLowerCase().replace(/\s+/g, '-')}`}
              className={`${brandClasses.surface} p-6 rounded-lg transition-all duration-300 hover:shadow-lg ${brandClasses.accent} border group`}
              style={{ 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.glass.border 
              }}
            >
              <div className="text-center">
                <div className={`text-2xl mb-3 transition-colors ${brandClasses.text.accent}`}>
                  {brand === 'primediscreet' ? '◆' : '♦'}
                </div>
                <h3 className={`font-medium transition-colors ${brandClasses.text.primary} group-hover:${brandClasses.text.accent}`}>
                  {category}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Brand-Specific Pricing Tiers */}
      <div className={`${brandClasses.surface} transition-all duration-500`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className={`text-3xl font-bold mb-8 transition-colors ${brandClasses.text.primary}`}>
            {brand === 'primediscreet' ? 'Premium Tiers' : 'Shop by Price'}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricingTiers.map((tier, index) => (
              <div 
                key={tier.label}
                className={`p-6 rounded-lg transition-all duration-300 hover:shadow-lg ${brandClasses.accent} border`}
                style={{ 
                  backgroundColor: brand === 'primediscreet' ? theme.colors.background : theme.colors.surface,
                  borderColor: theme.colors.glass.border 
                }}
              >
                <h3 className={`font-semibold mb-2 transition-colors ${brandClasses.text.primary}`}>
                  {tier.label}
                </h3>
                <p className={`text-sm transition-colors ${brandClasses.text.secondary}`}>
                  {brand === 'primediscreet' ? 'Curated selection' : 'Quality products'} in this range
                </p>
                <button className={`mt-4 px-4 py-2 rounded text-sm transition-all ${brandClasses.button.secondary}`}>
                  Browse {tier.label.split(' ')[0]}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Featured Tags */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className={`text-3xl font-bold mb-8 transition-colors ${brandClasses.text.primary}`}>
          {brand === 'primediscreet' ? 'Exclusive Features' : 'Popular Features'}
        </h2>
        
        <div className="flex flex-wrap gap-3">
          {featuredTags.map((tag) => (
            <span 
              key={tag}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer hover:opacity-80 ${brandClasses.button.secondary}`}
              style={{ 
                borderColor: theme.colors.accent,
                color: theme.colors.accent 
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Brand-Specific Footer Message */}
      <div className={`${brandClasses.surface} border-t transition-all duration-500`}
           style={{ borderColor: theme.colors.glass.border }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          {brand === 'primediscreet' ? (
            <div>
              <h3 className={`text-xl font-semibold mb-4 transition-colors ${brandClasses.text.primary}`}>
                Elite Membership Benefits
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <div className={`text-2xl mb-2 ${brandClasses.text.accent}`}>◆</div>
                  <h4 className={`font-medium mb-2 ${brandClasses.text.primary}`}>Ultra Discrete</h4>
                  <p className={`text-sm ${brandClasses.text.secondary}`}>Anonymous packaging & billing</p>
                </div>
                <div>
                  <div className={`text-2xl mb-2 ${brandClasses.text.accent}`}>◆</div>
                  <h4 className={`font-medium mb-2 ${brandClasses.text.primary}`}>Exclusive Access</h4>
                  <p className={`text-sm ${brandClasses.text.secondary}`}>Limited editions & early releases</p>
                </div>
                <div>
                  <div className={`text-2xl mb-2 ${brandClasses.text.accent}`}>◆</div>
                  <h4 className={`font-medium mb-2 ${brandClasses.text.primary}`}>Concierge Service</h4>
                  <p className={`text-sm ${brandClasses.text.secondary}`}>Personal shopping assistance</p>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <h3 className={`text-xl font-semibold mb-4 transition-colors ${brandClasses.text.primary}`}>
                Why Choose EntizNet Store
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <div className={`text-2xl mb-2 ${brandClasses.text.accent}`}>♦</div>
                  <h4 className={`font-medium mb-2 ${brandClasses.text.primary}`}>Premium Quality</h4>
                  <p className={`text-sm ${brandClasses.text.secondary}`}>Carefully curated luxury products</p>
                </div>
                <div>
                  <div className={`text-2xl mb-2 ${brandClasses.text.accent}`}>♦</div>
                  <h4 className={`font-medium mb-2 ${brandClasses.text.primary}`}>Discrete Delivery</h4>
                  <p className={`text-sm ${brandClasses.text.secondary}`}>Private packaging & secure shipping</p>
                </div>
                <div>
                  <div className={`text-2xl mb-2 ${brandClasses.text.accent}`}>♦</div>
                  <h4 className={`font-medium mb-2 ${brandClasses.text.primary}`}>Expert Support</h4>
                  <p className={`text-sm ${brandClasses.text.secondary}`}>Professional customer service</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}