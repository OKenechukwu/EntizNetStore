'use client'

import { useTheme } from '@/components/ThemeProvider'
import { useBrand } from '@/components/BrandProvider'
import { useState, useEffect } from 'react'
import { getLanguageFromCookie, SUPPORTED_LANGUAGES } from '@/lib/languages'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'

function readCookie(name: string) {
  if (typeof window === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export default function PlatformExperience() {
  const { theme, toggleTheme } = useTheme()
  const { brand, setBrand, theme: brandTheme } = useBrand()
  const [language, setLanguage] = useState('en')
  const [currency, setCurrency] = useState('USD')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedLanguage = readCookie('language') || 'en'
    const savedCurrency = readCookie('currency') || 'USD'
    setLanguage(savedLanguage)
    setCurrency(savedCurrency)
  }, [])

  if (!mounted) {
    return <div className="min-h-screen animate-pulse">Loading...</div>
  }

  const currentLanguage = SUPPORTED_LANGUAGES.find(l => l.code === language)

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-4xl">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-serif font-bold mb-4" style={{ color: brandTheme.colors.text.primary }}>
            Platform Experience
          </h1>
          <p className="text-lg" style={{ color: brandTheme.colors.text.secondary }}>
            Customize your {brand === 'entiznetstore' ? 'EntizNetStore' : 'PrimeDiscreet'} experience with theme, language, and display preferences.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Theme Settings */}
          <div 
            className="glass-card p-6 rounded-2xl border"
            style={{ 
              backgroundColor: brandTheme.colors.surface,
              borderColor: brandTheme.colors.glass.border 
            }}
          >
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3" style={{ color: brandTheme.colors.text.primary }}>
              🎨 Theme Mode
            </h2>

            <div className="space-y-4">
              {/* Light Mode Option */}
              <button
                onClick={() => theme === 'dark' && toggleTheme()}
                className={`w-full p-4 rounded-xl border-2 transition-all hover:scale-[1.02] ${
                  theme === 'light' ? 'border-accent-gold' : 'border-opacity-20'
                }`}
                style={{
                  backgroundColor: theme === 'light' ? brandTheme.colors.accent + '10' : brandTheme.colors.background,
                  borderColor: theme === 'light' ? brandTheme.colors.accent : brandTheme.colors.glass.border
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
                    <svg className="w-6 h-6 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-lg" style={{ color: brandTheme.colors.text.primary }}>
                      Light Mode
                    </h3>
                    <p className="text-sm" style={{ color: brandTheme.colors.text.secondary }}>
                      Clean, bright interface perfect for daytime browsing
                    </p>
                    {theme === 'light' && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-xs font-medium" style={{ color: brandTheme.colors.accent }}>
                          Currently Active
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </button>

              {/* Dark Mode Option */}
              <button
                onClick={() => theme === 'light' && toggleTheme()}
                className={`w-full p-4 rounded-xl border-2 transition-all hover:scale-[1.02] ${
                  theme === 'dark' ? 'border-accent-gold' : 'border-opacity-20'
                }`}
                style={{
                  backgroundColor: theme === 'dark' ? brandTheme.colors.accent + '10' : brandTheme.colors.background,
                  borderColor: theme === 'dark' ? brandTheme.colors.accent : brandTheme.colors.glass.border
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                    <svg className="w-6 h-6 text-slate-300" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-lg" style={{ color: brandTheme.colors.text.primary }}>
                      Dark Mode
                    </h3>
                    <p className="text-sm" style={{ color: brandTheme.colors.text.secondary }}>
                      Elegant dark interface that's easy on the eyes
                    </p>
                    {theme === 'dark' && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-xs font-medium" style={{ color: brandTheme.colors.accent }}>
                          Currently Active
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </button>

              {/* Auto Mode Info */}
              <div 
                className="p-4 rounded-xl border"
                style={{
                  backgroundColor: brandTheme.colors.background,
                  borderColor: brandTheme.colors.glass.border
                }}
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" style={{ color: brandTheme.colors.accent }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium" style={{ color: brandTheme.colors.text.primary }}>
                      System Preference Detection
                    </p>
                    <p className="text-xs" style={{ color: brandTheme.colors.text.secondary }}>
                      Theme automatically matches your device's system preference when first visiting
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Brand Experience */}
          <div 
            className="glass-card p-6 rounded-2xl border"
            style={{ 
              backgroundColor: brandTheme.colors.surface,
              borderColor: brandTheme.colors.glass.border 
            }}
          >
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3" style={{ color: brandTheme.colors.text.primary }}>
              🏪 Brand Experience
            </h2>

            <div className="space-y-4">
              {/* EntizNetStore Brand */}
              <button
                onClick={() => setBrand('entiznetstore')}
                className={`w-full p-4 rounded-xl border-2 transition-all hover:scale-[1.02] ${
                  brand === 'entiznetstore' ? 'border-accent-gold' : 'border-opacity-20'
                }`}
                style={{
                  backgroundColor: brand === 'entiznetstore' ? brandTheme.colors.accent + '10' : brandTheme.colors.background,
                  borderColor: brand === 'entiznetstore' ? brandTheme.colors.accent : brandTheme.colors.glass.border
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center">
                    <span className="text-white font-bold">E</span>
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-lg" style={{ color: brandTheme.colors.text.primary }}>
                      EntizNetStore
                    </h3>
                    <p className="text-sm" style={{ color: brandTheme.colors.text.secondary }}>
                      Warm luxury with gold accents and ivory theme
                    </p>
                    {brand === 'entiznetstore' && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-xs font-medium" style={{ color: brandTheme.colors.accent }}>
                          Currently Active
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </button>

              {/* PrimeDiscreet Brand */}
              <button
                onClick={() => setBrand('primediscreet')}
                className={`w-full p-4 rounded-xl border-2 transition-all hover:scale-[1.02] ${
                  brand === 'primediscreet' ? 'border-accent-gold' : 'border-opacity-20'
                }`}
                style={{
                  backgroundColor: brand === 'primediscreet' ? brandTheme.colors.accent + '10' : brandTheme.colors.background,
                  borderColor: brand === 'primediscreet' ? brandTheme.colors.accent : brandTheme.colors.glass.border
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center">
                    <span className="text-white font-bold">P</span>
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-lg" style={{ color: brandTheme.colors.text.primary }}>
                      PrimeDiscreet
                    </h3>
                    <p className="text-sm" style={{ color: brandTheme.colors.text.secondary }}>
                      Sophisticated champagne and charcoal theme
                    </p>
                    {brand === 'primediscreet' && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-xs font-medium" style={{ color: brandTheme.colors.accent }}>
                          Currently Active
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Language & Region */}
          <div 
            className="glass-card p-6 rounded-2xl border"
            style={{ 
              backgroundColor: brandTheme.colors.surface,
              borderColor: brandTheme.colors.glass.border 
            }}
          >
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3" style={{ color: brandTheme.colors.text.primary }}>
              🌐 Language & Region
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: brandTheme.colors.text.primary }}>
                  Current Language
                </label>
                <div 
                  className="p-3 rounded-lg border"
                  style={{
                    backgroundColor: brandTheme.colors.background,
                    borderColor: brandTheme.colors.glass.border
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🌐</span>
                    <div>
                      <p className="font-medium" style={{ color: brandTheme.colors.text.primary }}>
                        {currentLanguage?.nativeName}
                      </p>
                      <p className="text-sm" style={{ color: brandTheme.colors.text.secondary }}>
                        {currentLanguage?.name}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: brandTheme.colors.text.primary }}>
                  Current Currency
                </label>
                <div 
                  className="p-3 rounded-lg border"
                  style={{
                    backgroundColor: brandTheme.colors.background,
                    borderColor: brandTheme.colors.glass.border
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">💱</span>
                    <div>
                      <p className="font-medium" style={{ color: brandTheme.colors.text.primary }}>
                        {currency}
                      </p>
                      <p className="text-sm" style={{ color: brandTheme.colors.text.secondary }}>
                        Prices shown in {currency}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs" style={{ color: brandTheme.colors.text.secondary }}>
                Change language and currency from the dropdown in the top navigation
              </p>
            </div>
          </div>

          {/* Display Preferences */}
          <div 
            className="glass-card p-6 rounded-2xl border"
            style={{ 
              backgroundColor: brandTheme.colors.surface,
              borderColor: brandTheme.colors.glass.border 
            }}
          >
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3" style={{ color: brandTheme.colors.text.primary }}>
              ⚙️ Display Preferences
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium" style={{ color: brandTheme.colors.text.primary }}>Glass Effects</p>
                  <p className="text-sm" style={{ color: brandTheme.colors.text.secondary }}>Modern glass blur effects for cards</p>
                </div>
                <div className="w-12 h-6 bg-green-500 rounded-full flex items-center px-1">
                  <div className="w-4 h-4 bg-white rounded-full ml-auto"></div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium" style={{ color: brandTheme.colors.text.primary }}>Smooth Animations</p>
                  <p className="text-sm" style={{ color: brandTheme.colors.text.secondary }}>Elegant transitions and hover effects</p>
                </div>
                <div className="w-12 h-6 bg-green-500 rounded-full flex items-center px-1">
                  <div className="w-4 h-4 bg-white rounded-full ml-auto"></div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium" style={{ color: brandTheme.colors.text.primary }}>High Contrast</p>
                  <p className="text-sm" style={{ color: brandTheme.colors.text.secondary }}>Enhanced contrast for accessibility</p>
                </div>
                <div className="w-12 h-6 bg-gray-300 rounded-full flex items-center px-1">
                  <div className="w-4 h-4 bg-white rounded-full"></div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium" style={{ color: brandTheme.colors.text.primary }}>Large Text</p>
                  <p className="text-sm" style={{ color: brandTheme.colors.text.secondary }}>Increase font size for better readability</p>
                </div>
                <div className="w-12 h-6 bg-gray-300 rounded-full flex items-center px-1">
                  <div className="w-4 h-4 bg-white rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Section */}
        <div 
          className="glass-card p-8 rounded-2xl border mt-8"
          style={{ 
            backgroundColor: brandTheme.colors.surface,
            borderColor: brandTheme.colors.glass.border 
          }}
        >
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3" style={{ color: brandTheme.colors.text.primary }}>
            👁️ Live Preview
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div 
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: brandTheme.colors.background,
                borderColor: brandTheme.colors.glass.border
              }}
            >
              <h3 className="font-semibold mb-2" style={{ color: brandTheme.colors.text.primary }}>Sample Card</h3>
              <p className="text-sm mb-3" style={{ color: brandTheme.colors.text.secondary }}>
                This is how content appears with your current theme settings.
              </p>
              <button 
                className="luxury-button text-sm px-4 py-2"
                style={{ backgroundColor: brandTheme.colors.accent }}
              >
                Sample Button
              </button>
            </div>

            <div 
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: brandTheme.colors.background,
                borderColor: brandTheme.colors.glass.border
              }}
            >
              <h3 className="font-semibold mb-2" style={{ color: brandTheme.colors.text.primary }}>Color Palette</h3>
              <div className="flex gap-2 mb-3">
                <div className="w-6 h-6 rounded" style={{ backgroundColor: brandTheme.colors.accent }}></div>
                <div className="w-6 h-6 rounded" style={{ backgroundColor: brandTheme.colors.text.primary }}></div>
                <div className="w-6 h-6 rounded" style={{ backgroundColor: brandTheme.colors.surface }}></div>
                <div className="w-6 h-6 rounded" style={{ backgroundColor: brandTheme.colors.background }}></div>
              </div>
              <p className="text-xs" style={{ color: brandTheme.colors.text.secondary }}>
                Brand color scheme preview
              </p>
            </div>

            <div 
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: brandTheme.colors.background,
                borderColor: brandTheme.colors.glass.border
              }}
            >
              <h3 className="font-semibold mb-2" style={{ color: brandTheme.colors.text.primary }}>
                {brand === 'entiznetstore' ? 'EntizNetStore' : 'PrimeDiscreet'} Style
              </h3>
              <p className="text-sm" style={{ color: brandTheme.colors.text.secondary }}>
                {brand === 'entiznetstore' 
                  ? 'Warm luxury aesthetic with gold accents'
                  : 'Sophisticated premium design with champagne tones'
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}