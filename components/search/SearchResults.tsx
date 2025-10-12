'use client'

import { useState } from 'react'
import { useBrand } from '@/components/BrandProvider'
import Link from 'next/link'
import Price from '@/components/common/Price'

interface SearchResultsProps {
  results: any[]
  loading?: boolean
  query?: string
  totalResults?: number
}

export default function SearchResults({ 
  results, 
  loading = false, 
  query = '', 
  totalResults = 0 
}: SearchResultsProps) {
  const { brand, theme } = useBrand()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const StarRating = ({ rating, reviewCount }: { rating: number, reviewCount: number }) => (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map(star => (
          <span 
            key={star}
            className="text-sm"
            style={{ color: star <= rating ? theme.colors.accent : theme.colors.text.secondary }}
          >
            ★
          </span>
        ))}
      </div>
      <span className="text-xs" style={{ color: theme.colors.text.secondary }}>
        ({reviewCount})
      </span>
    </div>
  )

  const formatPrice = (price: number, comparePrice?: number) => (
    <div className="flex items-center gap-2">
      <span className="font-semibold text-lg" style={{ color: theme.colors.accent }}>
        <Price amount={price} />
      </span>
      {comparePrice && comparePrice > price && (
        <span className="text-sm line-through" style={{ color: theme.colors.text.secondary }}>
          <Price amount={comparePrice} />
        </span>
      )}
    </div>
  )

  const ProductCard = ({ product }: { product: any }) => (
    <Link href={`/products/${product.slug}`}>
      <div className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
           style={{ borderColor: theme.colors.glass.border }}>
        
        {/* Product Image */}
        <div className="relative aspect-square overflow-hidden">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center"
                 style={{ backgroundColor: theme.colors.background }}>
              <span className="text-4xl" style={{ color: theme.colors.text.secondary }}>
                🎁
              </span>
            </div>
          )}
          
          {/* Sale Badge */}
          {product.on_sale && (
            <div className="absolute top-2 left-2 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded">
              SALE
            </div>
          )}
          
          {/* Brand Badge */}
          {brand === 'primediscreet' && (
            <div className="absolute top-2 right-2 px-2 py-1 text-xs font-bold rounded"
                 style={{ 
                   backgroundColor: theme.colors.accent,
                   color: theme.colors.background
                 }}>
              ELITE
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold line-clamp-2" style={{ color: theme.colors.text.primary }}>
              {product.title}
            </h3>
            {product.seller?.storefront_name && (
              <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
                by {product.seller.storefront_name}
              </p>
            )}
          </div>

          {/* Rating */}
          {product.rating > 0 && (
            <StarRating rating={product.rating} reviewCount={product.review_count} />
          )}

          {/* Price */}
          {formatPrice(product.base_price, product.compare_at_price)}

          {/* Quick Features */}
          <div className="flex flex-wrap gap-1">
            {product.tags?.slice(0, 2).map((tag: string, index: number) => (
              <span 
                key={index}
                className="px-2 py-1 text-xs rounded"
                style={{ 
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text.secondary
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  )

  const ProductListItem = ({ product }: { product: any }) => (
    <Link href={`/products/${product.slug}`}>
      <div className="flex gap-4 p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer"
           style={{ borderColor: theme.colors.glass.border }}>
        
        {/* Product Image */}
        <div className="flex-shrink-0 w-24 h-24 overflow-hidden rounded">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center"
                 style={{ backgroundColor: theme.colors.background }}>
              <span className="text-2xl" style={{ color: theme.colors.text.secondary }}>
                🎁
              </span>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold" style={{ color: theme.colors.text.primary }}>
                {product.title}
              </h3>
              {product.seller?.storefront_name && (
                <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
                  by {product.seller.storefront_name}
                </p>
              )}
            </div>
            
            <div className="text-right">
              {formatPrice(product.base_price, product.compare_at_price)}
              {product.on_sale && (
                <div className="text-xs text-red-500 font-medium">ON SALE</div>
              )}
            </div>
          </div>

          {/* Rating */}
          {product.rating > 0 && (
            <StarRating rating={product.rating} reviewCount={product.review_count} />
          )}

          {/* Description */}
          {product.short_description && (
            <p className="text-sm line-clamp-2" style={{ color: theme.colors.text.secondary }}>
              {product.short_description}
            </p>
          )}

          {/* Features */}
          <div className="flex flex-wrap gap-1">
            {product.tags?.slice(0, 4).map((tag: string, index: number) => (
              <span 
                key={index}
                className="px-2 py-1 text-xs rounded"
                style={{ 
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text.secondary
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, index) => (
            <div key={index} className="border rounded-lg overflow-hidden animate-pulse"
                 style={{ borderColor: theme.colors.glass.border }}>
              <div className="aspect-square" style={{ backgroundColor: theme.colors.background }}></div>
              <div className="p-4 space-y-3">
                <div className="h-4 rounded" style={{ backgroundColor: theme.colors.background }}></div>
                <div className="h-3 rounded w-2/3" style={{ backgroundColor: theme.colors.background }}></div>
                <div className="h-6 rounded w-1/3" style={{ backgroundColor: theme.colors.background }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (results.length === 0 && query) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="text-6xl" style={{ color: theme.colors.text.secondary }}>🔍</div>
        <h3 className="text-xl font-semibold" style={{ color: theme.colors.text.primary }}>
          No results found
        </h3>
        <p style={{ color: theme.colors.text.secondary }}>
          We couldn't find any {brand === 'primediscreet' ? 'elite products' : 'products'} matching "{query}"
        </p>
        <div className="space-y-2">
          <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
            Try:
          </p>
          <ul className="text-sm space-y-1" style={{ color: theme.colors.text.secondary }}>
            <li>• Checking your spelling</li>
            <li>• Using different keywords</li>
            <li>• Removing some filters</li>
            <li>• Browsing our categories instead</li>
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Results Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
            {totalResults > 0 ? `${totalResults} Products` : `${results.length} Products`}
            {query && (
              <span style={{ color: theme.colors.text.secondary }}>
                {' '}for "{query}"
              </span>
            )}
          </h2>
          {brand === 'primediscreet' && (
            <p className="text-sm" style={{ color: theme.colors.accent }}>
              Elite curated collection
            </p>
          )}
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded transition-colors ${
              viewMode === 'grid' ? 'text-white' : ''
            }`}
            style={{
              backgroundColor: viewMode === 'grid' ? theme.colors.accent : 'transparent',
              color: viewMode === 'grid' 
                ? (brand === 'primediscreet' ? theme.colors.background : 'white')
                : theme.colors.text.secondary
            }}
          >
            ⊞
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded transition-colors ${
              viewMode === 'list' ? 'text-white' : ''
            }`}
            style={{
              backgroundColor: viewMode === 'list' ? theme.colors.accent : 'transparent',
              color: viewMode === 'list' 
                ? (brand === 'primediscreet' ? theme.colors.background : 'white')
                : theme.colors.text.secondary
            }}
          >
            ☰
          </button>
        </div>
      </div>

      {/* Results Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {results.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {results.map(product => (
            <ProductListItem key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Load More */}
      {results.length >= 20 && (
        <div className="text-center pt-8">
          <button
            className="px-6 py-3 border rounded-lg font-medium transition-all hover:shadow-md"
            style={{
              borderColor: theme.colors.glass.border,
              color: theme.colors.text.primary
            }}
          >
            Load More Results
          </button>
        </div>
      )}
    </div>
  )
}