'use client'

import { useState } from 'react'
import { useBrand } from '@/components/BrandProvider'
import { useAuth } from '@/components/AuthProvider'
import Link from 'next/link'
import { T } from '@/components/i18n/I18nProvider'

interface MobileHeaderProps {
  title?: string
  showBack?: boolean
  showMenu?: boolean
  onBackClick?: () => void
  className?: string
}

export default function MobileHeader({ 
  title, 
  showBack = false, 
  showMenu = true,
  onBackClick,
  className = '' 
}: MobileHeaderProps) {
  const { theme, brand, setBrand } = useBrand()
  const { user, signOut } = useAuth()
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  const handleBackClick = () => {
    if (onBackClick) onBackClick()
    else window.history.back()
  }

  const menuItems = [
    { label: 'Home', href: brand === 'primediscreet' ? '/primediscreet' : '/entiznet', icon: '🏠' },
    { label: 'Products', href: '/products', icon: '📦' },
    { label: 'Categories', href: '/categories', icon: '📋' },
    { label: 'Wishlist', href: '/wishlist', icon: '🤍' },
    { label: 'Orders', href: '/orders', icon: '🛒' },
    ...(user ? [
      { label: 'Messages', href: '/messages', icon: '💬' },
      { label: 'Profile', href: '/profile', icon: '👤' },
      { label: 'Seller Dashboard', href: '/seller', icon: '🏪' }
    ] : [
      { label: 'Sign In', href: '/auth/signin', icon: '🔑' },
      { label: 'Sign Up', href: '/auth/signup', icon: '📝' }
    ])
  ]

  return (
    <>
      {/* Mobile Header */}
      <header 
        className={`sticky top-0 z-40 backdrop-blur-md border-b ${className}`}
        style={{
          backgroundColor: `${theme.colors.surface}F0`,
          borderBottomColor: theme.colors.glass.border
        }}
      >
        <div className="flex items-center justify-between h-14 px-4">

          {/* Left Section */}
          <div className="flex items-center gap-3">
            {showBack && (
              <button
                onClick={handleBackClick}
                className="p-2 -ml-2 transition-colors active:scale-95"
                style={{ color: theme.colors.text.primary }}
                aria-label="Go back"
              >
                <span className="text-xl">←</span>
              </button>
            )}

            {/* Title or Logo */}
            {title ? (
              <h1 className="text-lg font-semibold truncate" style={{ color: theme.colors.text.primary }}>
                {title}
              </h1>
            ) : (
              <Link href={brand === 'primediscreet' ? '/primediscreet' : '/entiznet'}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                       style={{ backgroundColor: theme.colors.accent }}>
                    <span className="text-lg font-bold"
                          style={{ color: brand === 'primediscreet' ? theme.colors.background : 'white' }}>
                      {brand === 'primediscreet' ? 'P' : 'E'}
                    </span>
                  </div>
                  <span className="font-bold text-lg" style={{ color: theme.colors.text.primary }}>
                    {brand === 'primediscreet' ? 'Prime' : 'Entiz'}
                  </span>
                </div>
              </Link>
            )}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-2">
            {/* Brand Toggle */}
            <button
              onClick={() => setBrand(brand === 'primediscreet' ? 'entiznetstore' : 'primediscreet')}
              className="p-2 rounded-lg transition-all active:scale-95"
              style={{ 
                backgroundColor: theme.colors.background,
                color: theme.colors.text.secondary 
              }}
              aria-label="Toggle brand"
            >
              <span className="text-sm">
                {brand === 'primediscreet' ? '💎' : '✨'}
              </span>
            </button>

            {/* Menu Button */}
            {showMenu && (
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="p-2 transition-colors active:scale-95"
                style={{ color: theme.colors.text.primary }}
                aria-label="Open menu"
              >
                <span className="text-xl">☰</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setShowMobileMenu(false)}
          />

          {/* Menu Panel */}
          <div 
            className="absolute top-0 right-0 h-full w-80 max-w-[85vw] border-l shadow-xl"
            style={{
              backgroundColor: theme.colors.surface,
              borderLeftColor: theme.colors.glass.border
            }}
          >
            {/* Menu Header */}
            <div className="flex items-center justify-between p-4 border-b"
                 style={{ borderBottomColor: theme.colors.glass.border }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center"
                     style={{ backgroundColor: theme.colors.accent }}>
                  <span className="text-lg font-bold"
                        style={{ color: brand === 'primediscreet' ? theme.colors.background : 'white' }}>
                    {user?.email?.[0]?.toUpperCase() || (brand === 'primediscreet' ? 'P' : 'E')}
                  </span>
                </div>
                <div>
                  <p className="font-semibold" style={{ color: theme.colors.text.primary }}>
                    {user ? 'Welcome back!' : `${brand === 'primediscreet' ? 'Elite' : 'Premium'} Store`}
                  </p>
                  <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
                    {user ? user.email : 'Sign in for personalized experience'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-2 transition-colors"
                style={{ color: theme.colors.text.secondary }}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            {/* Menu Items */}
            <div className="flex-1 overflow-y-auto p-4">
              <nav className="space-y-2">
                {menuItems.map((item, index) => (
                  <Link
                    key={index}
                    href={item.href}
                    onClick={() => setShowMobileMenu(false)}
                    className="flex items-center gap-3 p-3 rounded-lg transition-colors active:scale-95"
                    style={{ 
                      backgroundColor: 'transparent',
                      color: theme.colors.text.primary
                    }}
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </Link>
                ))}

                {/* Sign Out */}
                {user && (
                  <button
                    onClick={() => {
                      signOut()
                      setShowMobileMenu(false)
                    }}
                    className="flex items-center gap-3 p-3 rounded-lg transition-colors w-full text-left active:scale-95"
                    style={{ color: '#ef4444' }}
                  >
                    <span className="text-xl">🚪</span>
                    <span className="font-medium">
                      <T k="auth.signOut" fallback="Sign Out" />
                    </span>
                  </button>
                )}
              </nav>
            </div>

            {/* Menu Footer */}
            <div className="p-4 border-t"
                 style={{ borderTopColor: theme.colors.glass.border }}>
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: theme.colors.text.primary }}>
                  {brand === 'primediscreet' ? 'Elite Collection' : 'EntizNetStore'}
                </p>
                <p className="text-xs" style={{ color: theme.colors.text.secondary }}>
                  Premium adult marketplace
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
