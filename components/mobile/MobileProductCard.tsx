'use client'

import { useState } from 'react'
import { useBrand } from '@/components/BrandProvider'
import WishlistButton from '@/components/wishlist/WishlistButton'
import Link from 'next/link'
import Price from '@/components/common/Price'

interface MobileProductCardProps {
  product: {
    id: string
    title: string
    slug: string
    base_price: number
    compare_at_price?: number
    image_url?: string
    rating?: number
    review_count?: number
    on_sale?: boolean
    tags?: string[]
    seller?: {
      storefront_name: string
    }
  }
  className?: string
}

export default function MobileProductCard({ product, className = '' }: MobileProductCardProps) {
  const { theme, brand } = useBrand()
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)

  const StarRating = ({ rating, reviewCount }: { rating: number, reviewCount: number }) => (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map(star => (
          <span 
            key={star}
            className="text-xs"
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
    <div className="flex items-center gap-1 flex-wrap">
      <span className="font-bold text-base" style={{ color: theme.colors.accent }}>
        <Price amount={price} />
      </span>
      {comparePrice && comparePrice > price && (
        <span className="text-xs line-through" style={{ color: theme.colors.text.secondary }}>
          <Price amount={comparePrice} />
        </span>
      )}
    </div>
  )

  return (
    <div className={`border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 active:scale-98 ${className}`}
         style={{ borderColor: theme.colors.glass.border }}>
      
      {/* Product Image */}
      <div className="relative aspect-square overflow-hidden">
        <Link href={`/products/${product.slug}`}>
          {product.image_url && !imageError ? (
            <div className="relative w-full h-full">
              {!imageLoaded && (
                <div className="absolute inset-0 animate-pulse"
                     style={{ backgroundColor: theme.colors.background }}>
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-2xl" style={{ color: theme.colors.text.secondary }}>
                      ⏳
                    </span>
                  </div>
                </div>
              )}
              <img
                src={product.image_url}
                alt={product.title}
                className={`w-full h-full object-cover transition-all duration-300 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center"
                 style={{ backgroundColor: theme.colors.background }}>
              <span className="text-3xl" style={{ color: theme.colors.text.secondary }}>
                🎁
              </span>
            </div>
          )}
        </Link>
        
        {/* Sale Badge */}
        {product.on_sale && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-md">
            SALE
          </div>
        )}
        
        {/* Brand Badge */}
        {brand === 'primediscreet' && (
          <div className="absolute top-2 right-8 px-2 py-1 text-xs font-bold rounded-md"
               style={{ 
                 backgroundColor: theme.colors.accent,
                 color: theme.colors.background
               }}>
            ELITE
          </div>
        )}
        
        {/* Wishlist Button */}
        <div className="absolute top-2 right-2">
          <WishlistButton 
            productId={product.id} 
            size="sm"
          />
        </div>
      </div>

      {/* Product Info */}
      <div className="p-3 space-y-2">
        <Link href={`/products/${product.slug}`}>
          <h3 className="font-semibold text-sm line-clamp-2 hover:opacity-80 transition-opacity" 
              style={{ color: theme.colors.text.primary }}>
            {product.title}
          </h3>
        </Link>

        {/* Seller */}
        {product.seller?.storefront_name && (
          <p className="text-xs" style={{ color: theme.colors.text.secondary }}>
            by {product.seller.storefront_name}
          </p>
        )}

        {/* Rating */}
        {product.rating && product.rating > 0 && (
          <StarRating rating={product.rating} reviewCount={product.review_count || 0} />
        )}

        {/* Price */}
        {formatPrice(product.base_price, product.compare_at_price)}

        {/* Tags */}
        {product.tags && product.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
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
            {product.tags.length > 2 && (
              <span 
                className="px-2 py-1 text-xs rounded-full"
                style={{ 
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text.secondary
                }}
              >
                +{product.tags.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Quick Add to Cart */}
        <button
          className="w-full py-2 rounded-lg font-medium text-sm transition-all duration-200 active:scale-95 mt-2"
          style={{
            backgroundColor: theme.colors.accent,
            color: brand === 'primediscreet' ? theme.colors.background : 'white'
          }}
        >
          Quick Add
        </button>
      </div>
    </div>
  )
}