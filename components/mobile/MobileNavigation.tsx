'use client'

import { useState, useEffect } from 'react'
import { useBrand } from '@/components/BrandProvider'
import { useAuth } from '@/components/AuthProvider'
import { useWishlist } from '@/components/wishlist/WishlistProvider'
import Link from 'next/link'

interface MobileNavigationProps {
  className?: string
}

export default function MobileNavigation({ className = '' }: MobileNavigationProps) {
  const { theme, brand } = useBrand()
  const { user } = useAuth()
  const { wishlistCount } = useWishlist()
  const [activeTab, setActiveTab] = useState('home')

  const navigationItems = [
    {
      id: 'home',
      label: 'Home',
      icon: '🏠',
      href: brand === 'primediscreet' ? '/primediscreet' : '/entiznet'
    },
    {
      id: 'search',
      label: 'Search',
      icon: '🔍',
      href: '/search'
    },
    {
      id: 'wishlist',
      label: 'Wishlist',
      icon: '🤍',
      href: '/wishlist',
      badge: wishlistCount > 0 ? wishlistCount : undefined
    },
    {
      id: 'cart',
      label: 'Cart',
      icon: '🛒',
      href: '/cart'
    },
    {
      id: 'profile',
      label: user ? 'Profile' : 'Sign In',
      icon: user ? '👤' : '🔑',
      href: user ? '/profile' : '/auth/signin'
    }
  ]

  useEffect(() => {
    // Set active tab based on current path
    const path = window.location.pathname
    const matchingItem = navigationItems.find(item => 
      path === item.href || (item.id === 'home' && path === '/')
    )
    if (matchingItem) {
      setActiveTab(matchingItem.id)
    }
  }, [])

  return (
    <nav 
      className={`fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-md ${className}`}
      style={{
        backgroundColor: `${theme.colors.surface}E6`, // 90% opacity
        borderTopColor: theme.colors.glass.border
      }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navigationItems.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            onClick={() => setActiveTab(item.id)}
            className="flex flex-col items-center justify-center min-w-0 flex-1 py-1 transition-all duration-200 active:scale-95"
          >
            <div className="relative">
              {/* Icon */}
              <div 
                className={`text-xl mb-1 transition-all duration-200 ${
                  activeTab === item.id ? 'scale-110' : ''
                }`}
                style={{
                  color: activeTab === item.id ? theme.colors.accent : theme.colors.text.secondary,
                  filter: activeTab === item.id ? 'drop-shadow(0 0 4px currentColor)' : 'none'
                }}
              >
                {item.icon === '🤍' && activeTab === item.id ? '❤️' : item.icon}
              </div>
              
              {/* Badge */}
              {item.badge && (
                <div 
                  className="absolute -top-1 -right-1 min-w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: '#ef4444',
                    color: 'white'
                  }}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </div>
              )}
            </div>
            
            {/* Label */}
            <span 
              className={`text-xs font-medium transition-colors duration-200 ${
                activeTab === item.id ? 'font-semibold' : ''
              }`}
              style={{
                color: activeTab === item.id ? theme.colors.accent : theme.colors.text.secondary
              }}
            >
              {item.label}
            </span>
            
            {/* Active indicator */}
            {activeTab === item.id && (
              <div 
                className="absolute -top-px left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full"
                style={{ backgroundColor: theme.colors.accent }}
              />
            )}
          </Link>
        ))}
      </div>
    </nav>
  )
}

// Hook for managing mobile navigation state
export function useMobileNavigation() {
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      // Hide navigation when scrolling down, show when scrolling up
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false)
      } else {
        setIsVisible(true)
      }
      
      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  return { isVisible }
}