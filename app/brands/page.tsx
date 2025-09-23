'use client'

import { useState, useEffect } from 'react'
import { useBrand } from '@/components/BrandProvider'
import Link from 'next/link'

interface DemoBrand {
  id: string
  name: string
  slug: string
  description: string
  productCount: number
  isVerified: boolean
  category: string
  founded: string
  rating: number
}

export default function BrandsPage() {
  const { theme, brand } = useBrand()
  const [brands, setBrands] = useState<DemoBrand[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCategory, setFilterCategory] = useState('all')

  useEffect(() => {
    loadBrands()
  }, [brand])

  const loadBrands = async () => {
    setLoading(true)
    
    // Demo brands based on marketplace brand
    const demoBrands: DemoBrand[] = brand === 'primediscreet' ? [
      {
        id: '1', name: 'Platinum Elite', slug: 'platinum-elite',
        description: 'Luxury intimate products crafted from the finest materials with uncompromising attention to detail.',
        productCount: 24, isVerified: true, category: 'Premium Collections',
        founded: '2018', rating: 4.9
      },
      {
        id: '2', name: 'Crystal Artisans', slug: 'crystal-artisans',
        description: 'Handcrafted crystal wellness products created by master artisans using traditional techniques.',
        productCount: 18, isVerified: true, category: 'Luxury Wellness',
        founded: '2020', rating: 4.8
      },
      {
        id: '3', name: 'Silk Dreams', slug: 'silk-dreams',
        description: 'Exquisite silk lingerie and intimate apparel designed for the sophisticated woman.',
        productCount: 32, isVerified: true, category: 'Designer Lingerie',
        founded: '2015', rating: 4.7
      },
      {
        id: '4', name: 'Intimate Elite', slug: 'intimate-elite',
        description: 'Exclusive couples products designed to enhance intimacy and connection.',
        productCount: 16, isVerified: true, category: 'Couples Elite',
        founded: '2019', rating: 4.9
      },
      {
        id: '5', name: 'Gold Artisans', slug: 'gold-artisans',
        description: 'Luxury products featuring precious metals and artisan craftsmanship.',
        productCount: 12, isVerified: true, category: 'Artisan Crafted',
        founded: '2021', rating: 5.0
      },
      {
        id: '6', name: 'Elite Wellness', slug: 'elite-wellness',
        description: 'Premium wellness products for the discerning individual.',
        productCount: 28, isVerified: true, category: 'Luxury Wellness',
        founded: '2017', rating: 4.6
      }
    ] : [
      {
        id: '1', name: 'EntizCare', slug: 'entizcare',
        description: 'Trusted wellness products designed for personal health and comfort.',
        productCount: 45, isVerified: true, category: 'Wellness',
        founded: '2016', rating: 4.6
      },
      {
        id: '2', name: 'ComfortZone', slug: 'comfortzone',
        description: 'Professional massage and relaxation products for home use.',
        productCount: 28, isVerified: true, category: 'Massage',
        founded: '2018', rating: 4.5
      },
      {
        id: '3', name: 'Together+', slug: 'together-plus',
        description: 'Products designed to strengthen relationships and enhance communication.',
        productCount: 34, isVerified: true, category: 'Couples',
        founded: '2019', rating: 4.7
      },
      {
        id: '4', name: 'CareFirst', slug: 'carefirst',
        description: 'Essential personal care products with a focus on quality and safety.',
        productCount: 52, isVerified: true, category: 'Personal Care',
        founded: '2015', rating: 4.3
      },
      {
        id: '5', name: 'Journey+', slug: 'journey-plus',
        description: 'Comprehensive wellness solutions for your personal journey.',
        productCount: 21, isVerified: true, category: 'Wellness',
        founded: '2020', rating: 4.8
      },
      {
        id: '6', name: 'WellnessFirst', slug: 'wellnessfirst',
        description: 'Evidence-based wellness products backed by research.',
        productCount: 38, isVerified: true, category: 'Health',
        founded: '2017', rating: 4.4
      }
    ]

    // Simulate API delay
    setTimeout(() => {
      setBrands(demoBrands)
      setLoading(false)
    }, 500)
  }

  const categories = [...new Set(brands.map(b => b.category))]
  const filteredBrands = filterCategory === 'all' 
    ? brands 
    : brands.filter(b => b.category === filterCategory)

  const BrandCard = ({ brandData }: { brandData: DemoBrand }) => (
    <div className="border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 group"
         style={{ borderColor: theme.colors.glass.border }}>
      
      {/* Brand Logo/Avatar */}
      <div className="aspect-video relative overflow-hidden"
           style={{ backgroundColor: theme.colors.surface }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center"
                 style={{ backgroundColor: theme.colors.accent }}>
              <span className="text-xl font-bold"
                    style={{ color: brand === 'primediscreet' ? theme.colors.background : 'white' }}>
                {brandData.name.split(' ').map(word => word[0]).join('')}
              </span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <h3 className="font-semibold" style={{ color: theme.colors.text.primary }}>
                {brandData.name}
              </h3>
              {brandData.isVerified && (
                <div className="w-5 h-5 rounded-full flex items-center justify-center"
                     style={{ backgroundColor: theme.colors.accent }}>
                  <span className="text-xs"
                        style={{ color: brand === 'primediscreet' ? theme.colors.background : 'white' }}>
                    ✓
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Brand Info */}
      <div className="p-6">
        {/* Category Badge */}
        <div className="mb-3">
          <span className="text-xs font-medium px-2 py-1 rounded-full"
                style={{ 
                  backgroundColor: theme.colors.background,
                  color: theme.colors.accent
                }}>
            {brandData.category}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm mb-4 line-clamp-3" style={{ color: theme.colors.text.secondary }}>
          {brandData.description}
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-center">
          <div>
            <p className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
              {brandData.productCount}
            </p>
            <p className="text-xs" style={{ color: theme.colors.text.secondary }}>
              Products
            </p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1">
              <span className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
                {brandData.rating}
              </span>
              <span className="text-sm" style={{ color: theme.colors.accent }}>★</span>
            </div>
            <p className="text-xs" style={{ color: theme.colors.text.secondary }}>
              Rating
            </p>
          </div>
        </div>

        {/* Founded */}
        <div className="mb-4">
          <p className="text-xs" style={{ color: theme.colors.text.secondary }}>
            Founded in {brandData.founded}
          </p>
        </div>

        {/* View Products Button */}
        <Link
          href={`/brands/${brandData.slug}`}
          className="w-full py-2 px-4 rounded-lg font-medium text-center block transition-all hover:opacity-90 group-hover:scale-[1.02]"
          style={{
            backgroundColor: theme.colors.accent,
            color: brand === 'primediscreet' ? theme.colors.background : 'white'
          }}
        >
          View Products
        </Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.colors.background }}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: theme.colors.text.primary }}>
            {brand === 'primediscreet' ? 'Elite Brand Partners' : 'Featured Brands & Creators'}
          </h1>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: theme.colors.text.secondary }}>
            {brand === 'primediscreet' 
              ? 'Discover luxury intimate products from our carefully selected elite brand partners and independent artisans.'
              : 'Discover premium products from our verified brands and independent creators who share our commitment to quality.'
            }
          </p>
        </div>

        {/* Filter */}
        <div className="mb-8 flex justify-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium" style={{ color: theme.colors.text.secondary }}>
              Filter by category:
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
        </div>

        {/* Brands Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="border rounded-lg overflow-hidden animate-pulse"
                   style={{ borderColor: theme.colors.glass.border }}>
                <div className="aspect-video" style={{ backgroundColor: theme.colors.surface }}></div>
                <div className="p-6 space-y-3">
                  <div className="h-4 rounded" style={{ backgroundColor: theme.colors.surface }}></div>
                  <div className="h-3 rounded w-4/5" style={{ backgroundColor: theme.colors.surface }}></div>
                  <div className="h-3 rounded w-3/5" style={{ backgroundColor: theme.colors.surface }}></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBrands.map((brandData) => (
              <BrandCard key={brandData.id} brandData={brandData} />
            ))}
          </div>
        )}

        {/* Partner Application CTA */}
        <div className="mt-16">
          <div className="border rounded-lg p-8 text-center max-w-3xl mx-auto"
               style={{ 
                 borderColor: theme.colors.glass.border,
                 background: `linear-gradient(135deg, ${theme.colors.surface}80, ${theme.colors.background})`
               }}>
            <h2 className="text-2xl font-bold mb-4" style={{ color: theme.colors.text.primary }}>
              {brand === 'primediscreet' ? 'Become an Elite Partner' : 'Become a Brand Partner'}
            </h2>
            <p className="text-lg mb-6 max-w-2xl mx-auto" style={{ color: theme.colors.text.secondary }}>
              {brand === 'primediscreet' 
                ? 'Join our exclusive marketplace and reach discerning customers who value luxury, quality, and discretion. Our elite partnership program offers premium placement and dedicated support.'
                : 'Join our trusted marketplace and reach customers who value quality and discretion. We partner with verified brands and creators who share our commitment to excellence.'
              }
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/seller/apply"
                className="px-8 py-3 rounded-lg font-semibold transition-all hover:opacity-90"
                style={{
                  backgroundColor: theme.colors.accent,
                  color: brand === 'primediscreet' ? theme.colors.background : 'white'
                }}
              >
                {brand === 'primediscreet' ? 'Apply for Elite Partnership' : 'Apply to Sell'}
              </Link>
              <Link 
                href="/seller/requirements"
                className="px-8 py-3 rounded-lg font-semibold border transition-all hover:opacity-80"
                style={{
                  borderColor: theme.colors.accent,
                  color: theme.colors.accent
                }}
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        {!loading && (
          <div className="mt-8 text-center">
            <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
              Showing {filteredBrands.length} of {brands.length} brands
              {filterCategory !== 'all' && ` in ${filterCategory}`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}