'use client'

import { useState, useEffect } from 'react'
import { useBrand } from '@/components/BrandProvider'
import ProductSearchBar from '@/components/search/ProductSearchBar'
import Link from 'next/link'

interface DemoCategory {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  productCount: number
  subcategories: string[]
}

export default function CategoriesPage() {
  const { theme, brand } = useBrand()
  const [categories, setCategories] = useState<DemoCategory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCategories()
  }, [brand])

  const loadCategories = async () => {
    setLoading(true)
    
    // Demo categories based on brand
    const demoCategories: DemoCategory[] = brand === 'primediscreet' ? [
      {
        id: '1', name: 'Premium Collections', slug: 'premium-collections',
        description: 'Exclusive luxury sets curated for discerning clientele',
        icon: '💎', productCount: 24,
        subcategories: ['Elite Sets', 'Signature Collections', 'Limited Edition']
      },
      {
        id: '2', name: 'Luxury Wellness', slug: 'luxury-wellness',
        description: 'Premium wellness and massage products for ultimate relaxation',
        icon: '✨', productCount: 18,
        subcategories: ['Crystal Collection', 'Gold Series', 'Artisan Crafted']
      },
      {
        id: '3', name: 'Designer Lingerie', slug: 'designer-lingerie',
        description: 'High-end intimate apparel from renowned designers',
        icon: '👗', productCount: 32,
        subcategories: ['Silk Collection', 'Lace Artistry', 'Custom Fit']
      },
      {
        id: '4', name: 'Couples Elite', slug: 'couples-elite',
        description: 'Exclusive couples experiences and luxury products',
        icon: '💫', productCount: 16,
        subcategories: ['Romantic Sets', 'Experience Kits', 'Anniversary Collection']
      },
      {
        id: '5', name: 'Artisan Crafted', slug: 'artisan-crafted',
        description: 'Handcrafted luxury items from master artisans',
        icon: '🎨', productCount: 12,
        subcategories: ['Hand Blown Glass', 'Precious Metals', 'Custom Engraved']
      },
      {
        id: '6', name: 'Exclusive Memberships', slug: 'exclusive-memberships',
        description: 'Access to our most exclusive products and experiences',
        icon: '🔐', productCount: 8,
        subcategories: ['VIP Access', 'Private Collections', 'Concierge Service']
      }
    ] : [
      {
        id: '1', name: 'Wellness & Health', slug: 'wellness-health',
        description: 'Personal wellness and health products for your wellbeing',
        icon: '🌿', productCount: 45,
        subcategories: ['Massage Tools', 'Wellness Kits', 'Health Essentials']
      },
      {
        id: '2', name: 'Massage & Relaxation', slug: 'massage-relaxation',
        description: 'Professional massage tools and relaxation products',
        icon: '💆', productCount: 28,
        subcategories: ['Electric Massagers', 'Manual Tools', 'Aromatherapy']
      },
      {
        id: '3', name: 'Personal Care', slug: 'personal-care',
        description: 'Essential personal care and hygiene products',
        icon: '🧴', productCount: 52,
        subcategories: ['Cleansers', 'Moisturizers', 'Specialized Care']
      },
      {
        id: '4', name: 'Couples & Relationships', slug: 'couples-relationships',
        description: 'Products designed to enhance intimacy and connection',
        icon: '💕', productCount: 34,
        subcategories: ['Communication Tools', 'Relationship Kits', 'Couple Games']
      },
      {
        id: '5', name: 'Gift Sets & Bundles', slug: 'gift-sets-bundles',
        description: 'Carefully curated gift sets for special occasions',
        icon: '🎁', productCount: 21,
        subcategories: ['Starter Kits', 'Anniversary Gifts', 'Holiday Specials']
      },
      {
        id: '6', name: 'Educational & Resources', slug: 'educational-resources',
        description: 'Educational materials and resources for wellness',
        icon: '📚', productCount: 15,
        subcategories: ['Guides', 'Workshops', 'Online Courses']
      }
    ]

    // Simulate API delay
    setTimeout(() => {
      setCategories(demoCategories)
      setLoading(false)
    }, 500)
  }

  const CategoryCard = ({ category }: { category: DemoCategory }) => (
    <div className="border rounded-lg p-6 hover:shadow-lg transition-all duration-300 group"
         style={{ borderColor: theme.colors.glass.border }}>
      
      {/* Category Icon */}
      <div className="text-center mb-4">
        <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">
          {category.icon}
        </div>
        <h2 className="text-xl font-semibold group-hover:opacity-80 transition-opacity"
            style={{ color: theme.colors.text.primary }}>
          {category.name}
        </h2>
      </div>

      {/* Description */}
      <p className="text-sm mb-4 line-clamp-3" style={{ color: theme.colors.text.secondary }}>
        {category.description}
      </p>

      {/* Product Count */}
      <div className="mb-4">
        <span className="text-xs font-medium px-2 py-1 rounded-full"
              style={{ 
                backgroundColor: theme.colors.background,
                color: theme.colors.accent
              }}>
          {category.productCount} products
        </span>
      </div>

      {/* Subcategories */}
      <div className="space-y-2 mb-6">
        <p className="text-xs font-medium" style={{ color: theme.colors.text.secondary }}>
          Popular subcategories:
        </p>
        {category.subcategories.slice(0, 3).map((sub, index) => (
          <Link 
            key={index}
            href={`/categories/${category.slug}/${sub.toLowerCase().replace(/\s+/g, '-')}`}
            className="block text-sm hover:opacity-80 transition-opacity"
            style={{ color: theme.colors.text.primary }}
          >
            → {sub}
          </Link>
        ))}
      </div>

      {/* Browse Button */}
      <Link 
        href={`/categories/${category.slug}`}
        className="w-full py-2 px-4 rounded-lg font-medium text-center block transition-all hover:opacity-90"
        style={{
          backgroundColor: theme.colors.accent,
          color: brand === 'primediscreet' ? theme.colors.background : 'white'
        }}
      >
        Browse {category.name}
      </Link>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.colors.background }}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: theme.colors.text.primary }}>
            {brand === 'primediscreet' ? 'Elite Categories' : 'Product Categories'}
          </h1>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: theme.colors.text.secondary }}>
            {brand === 'primediscreet' 
              ? 'Explore our carefully curated collection of luxury intimate products, organized by exclusive categories.'
              : 'Explore our comprehensive collection of premium adult products, organized by category for easy browsing.'
            }
          </p>
        </div>

        {/* Search Panel */}
        <div className="mb-12">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
              Find What You're Looking For
            </h2>
            <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
              Search across all categories or browse by category below
            </p>
          </div>
          <ProductSearchBar 
            placeholder={brand === 'primediscreet' 
              ? "Search exclusive luxury products..." 
              : "Search for products, categories, or brands..."
            }
            className="max-w-3xl"
          />
        </div>

        {/* Filter Options */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <span className="text-xs sm:text-sm font-medium mb-2 sm:mb-0 w-full sm:w-auto text-center sm:text-left" 
                  style={{ color: theme.colors.text.secondary }}>
              Quick filters:
            </span>
            <div className="flex flex-wrap justify-center gap-2">
              {['New Arrivals', 'Best Sellers', 'On Sale', 'Premium', 'Beginner Friendly'].map((filter) => (
                <button
                  key={filter}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm border transition-all duration-300 hover:scale-105 hover:shadow-md whitespace-nowrap"
                  style={{
                    borderColor: theme.colors.glass.border,
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.text.primary
                  }}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Categories Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="border rounded-lg p-6 animate-pulse"
                   style={{ borderColor: theme.colors.glass.border }}>
                <div className="text-center mb-4">
                  <div className="w-12 h-12 rounded-full mx-auto mb-2"
                       style={{ backgroundColor: theme.colors.surface }}></div>
                  <div className="h-6 w-2/3 rounded mx-auto"
                       style={{ backgroundColor: theme.colors.surface }}></div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 rounded" style={{ backgroundColor: theme.colors.surface }}></div>
                  <div className="h-4 rounded w-4/5" style={{ backgroundColor: theme.colors.surface }}></div>
                  <div className="h-4 rounded w-3/5" style={{ backgroundColor: theme.colors.surface }}></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        )}

        {/* Call to Action */}
        <div className="mt-16 text-center">
          <div className="border rounded-lg p-8 max-w-2xl mx-auto"
               style={{ borderColor: theme.colors.glass.border }}>
            <h2 className="text-2xl font-bold mb-4" style={{ color: theme.colors.text.primary }}>
              {brand === 'primediscreet' ? 'Discover Elite Products' : 'Find What You\'re Looking For'}
            </h2>
            <p className="mb-6" style={{ color: theme.colors.text.secondary }}>
              {brand === 'primediscreet' 
                ? 'Browse our complete collection of luxury products or use our advanced search to find exactly what you need.'
                : 'Browse our complete collection or use our search feature to find exactly what you need.'
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/store"
                className="px-6 py-3 rounded-lg font-medium transition-all hover:opacity-90"
                style={{
                  backgroundColor: theme.colors.accent,
                  color: brand === 'primediscreet' ? theme.colors.background : 'white'
                }}
              >
                Browse All Products
              </Link>
              <Link 
                href="/search"
                className="px-6 py-3 rounded-lg font-medium border transition-all hover:opacity-80"
                style={{
                  borderColor: theme.colors.accent,
                  color: theme.colors.accent
                }}
              >
                Advanced Search
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}