'use client'

import { useState } from 'react'
import { useWishlist } from '@/components/wishlist/WishlistProvider'
import { useBrand } from '@/components/BrandProvider'
import { useAuth } from '@/components/AuthProvider'
import WishlistButton from '@/components/wishlist/WishlistButton'
import Link from 'next/link'
import Price from '@/components/common/Price'

export default function WishlistPage() {
  const { wishlistItems, isLoading, clearWishlist } = useWishlist()
  const { theme, brand } = useBrand()
  const { user } = useAuth()
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const handleClearWishlist = async () => {
    await clearWishlist()
    setShowClearConfirm(false)
  }

  const formatPrice = (price: number, originalPrice?: number) => (
    <div className="flex items-center gap-2">
      <span className="font-semibold text-lg" style={{ color: theme.colors.accent }}>
        <Price amount={price} />
      </span>
      {originalPrice && originalPrice > price && (
        <span className="text-sm line-through" style={{ color: theme.colors.text.secondary }}>
          <Price amount={originalPrice} />
        </span>
      )}
    </div>
  )

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: theme.colors.background }}>
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 rounded" style={{ backgroundColor: theme.colors.surface }}></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, index) => (
                <div key={index} className="border rounded-lg overflow-hidden"
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
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.colors.background }}>
      <div className="container mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: theme.colors.text.primary }}>
              {brand === 'primediscreet' ? 'Elite Favorites' : 'My Wishlist'}
            </h1>
            <p style={{ color: theme.colors.text.secondary }}>
              {wishlistItems.length} {wishlistItems.length === 1 ? 'item' : 'items'} saved
              {!user && ' (Guest list - sign in to save permanently)'}
            </p>
          </div>

          {wishlistItems.length > 0 && (
            <div className="flex items-center gap-4">
              {/* View Toggle */}
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

              {/* Clear All Button */}
              <button
                onClick={() => setShowClearConfirm(true)}
                className="px-4 py-2 border rounded-lg transition-colors hover:bg-opacity-80"
                style={{
                  borderColor: theme.colors.glass.border,
                  color: theme.colors.text.secondary
                }}
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* Empty State */}
        {wishlistItems.length === 0 && (
          <div className="text-center py-16 space-y-6">
            <div className="text-6xl" style={{ color: theme.colors.text.secondary }}>
              {brand === 'primediscreet' ? '⭐' : '🤍'}
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold" style={{ color: theme.colors.text.primary }}>
                {brand === 'primediscreet' ? 'No elite favorites yet' : 'Your wishlist is empty'}
              </h3>
              <p style={{ color: theme.colors.text.secondary }}>
                {brand === 'primediscreet' 
                  ? 'Start building your elite collection by saving products you love'
                  : 'Save products you love to view them later'
                }
              </p>
            </div>
            <Link 
              href={brand === 'primediscreet' ? '/primediscreet' : '/entiznet'}
              className="inline-block px-6 py-3 rounded-lg font-medium transition-all hover:shadow-md"
              style={{
                backgroundColor: theme.colors.accent,
                color: brand === 'primediscreet' ? theme.colors.background : 'white'
              }}
            >
              {brand === 'primediscreet' ? 'Browse Elite Collection' : 'Browse Products'}
            </Link>
          </div>
        )}

        {/* Wishlist Items Grid */}
        {wishlistItems.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {wishlistItems.map(item => (
              <div key={item.id} className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                   style={{ borderColor: theme.colors.glass.border }}>
                
                {/* Product Image */}
                <div className="relative aspect-square overflow-hidden">
                  <Link href={`/products/${item.product?.slug}`}>
                    {item.product?.image_url ? (
                      <img
                        src={item.product.image_url}
                        alt={item.product.title}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"
                           style={{ backgroundColor: theme.colors.surface }}>
                        <span className="text-4xl" style={{ color: theme.colors.text.secondary }}>
                          🎁
                        </span>
                      </div>
                    )}
                  </Link>
                  
                  {/* Remove Button */}
                  <div className="absolute top-2 right-2">
                    <WishlistButton 
                      productId={item.product_id} 
                      variantId={item.variant_id} 
                      size="sm"
                    />
                  </div>
                </div>

                {/* Product Info */}
                <div className="p-4 space-y-3">
                  <Link href={`/products/${item.product?.slug}`}>
                    <h3 className="font-semibold line-clamp-2 hover:opacity-80 transition-opacity" 
                        style={{ color: theme.colors.text.primary }}>
                      {item.product?.title}
                    </h3>
                  </Link>

                  {/* Price */}
                  {item.product && formatPrice(
                    item.product.base_price, 
                    item.product.compare_at_price
                  )}

                  {/* Add to Cart Button */}
                  <button
                    className="w-full py-2 rounded-lg font-medium transition-all hover:shadow-md"
                    style={{
                      backgroundColor: theme.colors.accent,
                      color: brand === 'primediscreet' ? theme.colors.background : 'white'
                    }}
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Wishlist Items List */}
        {wishlistItems.length > 0 && viewMode === 'list' && (
          <div className="space-y-4">
            {wishlistItems.map(item => (
              <div key={item.id} className="flex gap-4 p-4 border rounded-lg hover:shadow-md transition-shadow"
                   style={{ borderColor: theme.colors.glass.border }}>
                
                {/* Product Image */}
                <div className="flex-shrink-0 w-24 h-24 overflow-hidden rounded">
                  <Link href={`/products/${item.product?.slug}`}>
                    {item.product?.image_url ? (
                      <img
                        src={item.product.image_url}
                        alt={item.product.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"
                           style={{ backgroundColor: theme.colors.surface }}>
                        <span className="text-2xl" style={{ color: theme.colors.text.secondary }}>
                          🎁
                        </span>
                      </div>
                    )}
                  </Link>
                </div>

                {/* Product Info */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <Link href={`/products/${item.product?.slug}`}>
                        <h3 className="font-semibold hover:opacity-80 transition-opacity" 
                            style={{ color: theme.colors.text.primary }}>
                          {item.product?.title}
                        </h3>
                      </Link>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Price */}
                      {item.product && formatPrice(
                        item.product.base_price, 
                        item.product.compare_at_price
                      )}
                      
                      {/* Remove Button */}
                      <WishlistButton 
                        productId={item.product_id} 
                        variantId={item.variant_id} 
                        size="sm"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      className="px-4 py-2 rounded-lg font-medium transition-all hover:shadow-md"
                      style={{
                        backgroundColor: theme.colors.accent,
                        color: brand === 'primediscreet' ? theme.colors.background : 'white'
                      }}
                    >
                      Add to Cart
                    </button>
                    <span className="text-xs" style={{ color: theme.colors.text.secondary }}>
                      Saved {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Clear Confirmation Modal */}
        {showClearConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="max-w-md w-full mx-4 p-6 rounded-lg border"
                 style={{ 
                   backgroundColor: theme.colors.surface,
                   borderColor: theme.colors.glass.border 
                 }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: theme.colors.text.primary }}>
                Clear {brand === 'primediscreet' ? 'Elite Favorites' : 'Wishlist'}?
              </h3>
              <p className="mb-6" style={{ color: theme.colors.text.secondary }}>
                This will remove all {wishlistItems.length} items from your {brand === 'primediscreet' ? 'favorites' : 'wishlist'}. 
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2 px-4 border rounded-lg font-medium transition-colors"
                  style={{
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearWishlist}
                  className="flex-1 py-2 px-4 rounded-lg font-medium transition-colors"
                  style={{
                    backgroundColor: '#ef4444',
                    color: 'white'
                  }}
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}