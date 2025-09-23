'use client'

import { useState } from 'react'
import { useWishlist } from './WishlistProvider'
import { useBrand } from '@/components/BrandProvider'

interface WishlistButtonProps {
  productId: string
  variantId?: string
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

export default function WishlistButton({ 
  productId, 
  variantId, 
  size = 'md', 
  showText = false,
  className = '' 
}: WishlistButtonProps) {
  const { isInWishlist, toggleWishlist } = useWishlist()
  const { theme } = useBrand()
  const [isLoading, setIsLoading] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)

  const inWishlist = isInWishlist(productId, variantId)

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    setIsLoading(true)
    try {
      await toggleWishlist(productId, variantId)
    } catch (error) {
      console.error('Error toggling wishlist:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return showText ? 'px-2 py-1 text-sm' : 'p-1 text-sm'
      case 'lg':
        return showText ? 'px-4 py-3 text-lg' : 'p-3 text-lg'
      default:
        return showText ? 'px-3 py-2' : 'p-2'
    }
  }

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 'text-sm'
      case 'lg':
        return 'text-xl'
      default:
        return 'text-base'
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        disabled={isLoading}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          ${getSizeClasses()}
          rounded-lg border transition-all duration-200 disabled:opacity-50
          hover:scale-105 active:scale-95 flex items-center gap-2
          ${className}
        `}
        style={{
          borderColor: inWishlist ? theme.colors.accent : theme.colors.glass.border,
          backgroundColor: inWishlist ? theme.colors.accent : 'transparent',
          color: inWishlist 
            ? (theme.colors.background === '#1a1a1a' ? '#1a1a1a' : 'white')
            : theme.colors.text.primary
        }}
      >
        {/* Heart Icon with Animation */}
        <span 
          className={`
            ${getIconSize()}
            transition-all duration-200
            ${inWishlist ? 'animate-pulse' : ''}
            ${isLoading ? 'animate-spin' : ''}
          `}
        >
          {isLoading ? '○' : inWishlist ? '❤️' : '🤍'}
        </span>
        
        {showText && (
          <span className="font-medium">
            {inWishlist ? 'Saved' : 'Save'}
          </span>
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && !showText && (
        <div 
          className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs rounded shadow-lg whitespace-nowrap z-50"
          style={{
            backgroundColor: theme.colors.surface,
            color: theme.colors.text.primary,
            border: `1px solid ${theme.colors.glass.border}`
          }}
        >
          {inWishlist ? 'Remove from favorites' : 'Add to favorites'}
          <div 
            className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent"
            style={{ borderTopColor: theme.colors.glass.border }}
          ></div>
        </div>
      )}
    </div>
  )
}