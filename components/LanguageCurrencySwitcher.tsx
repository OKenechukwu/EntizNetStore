'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useBrand } from '@/components/BrandProvider'
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY, CURRENCY_NAMES, detectUserCurrency } from '@/lib/currency'
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, getLanguageName } from '@/lib/languages'

function readCookie(name: string) {
  if (typeof window === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export default function LanguageCurrencySwitcher() {
  const { theme } = useBrand()
  const router = useRouter()
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const savedCurrency = readCookie('currency')
    const savedLanguage = readCookie('language') || DEFAULT_LANGUAGE
    
    // If no currency is saved, automatically detect from user's locale/timezone
    if (!savedCurrency) {
      const detectedCurrency = detectUserCurrency()
      setCurrency(detectedCurrency)
      // Save the detected currency automatically
      fetch('/api/prefs/currency', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currency: detectedCurrency }),
      }).catch(error => console.warn('Failed to save detected currency:', error))
    } else {
      setCurrency(savedCurrency.toUpperCase())
    }
    
    setLanguage(savedLanguage)
  }, [])

  const handleCurrencyChange = async (newCurrency: string) => {
    setCurrency(newCurrency)
    try {
      await fetch('/api/prefs/currency', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currency: newCurrency }),
      })
    } catch (error) {
      console.warn('Failed to save currency preference:', error)
    }
    
    startTransition(() => router.refresh())
    setIsDropdownOpen(false)
  }

  const handleLanguageChange = async (newLanguage: string) => {
    setLanguage(newLanguage)
    try {
      await fetch('/api/prefs/language', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ language: newLanguage }),
      })
    } catch (error) {
      console.warn('Failed to save language preference:', error)
    }
    
    startTransition(() => router.refresh())
    setIsDropdownOpen(false)
  }

  const currentCurrencyInfo = CURRENCY_NAMES[currency] || { name: currency, symbol: currency }
  const currentLanguageInfo = SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0]

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        disabled={isPending}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:opacity-80 transition-all"
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.glass.border,
          color: theme.colors.text.primary
        }}
        aria-label="Language and Currency Settings"
      >
        <div className="flex items-center gap-1 text-sm">
          <span>🌐</span>
          <span className="hidden sm:inline">{currentLanguageInfo.code.toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <span>{currentCurrencyInfo.symbol}</span>
          <span className="hidden sm:inline">{currency}</span>
        </div>
        <svg 
          className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div 
          className="absolute right-0 mt-2 w-80 rounded-lg border shadow-lg z-50"
          style={{
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.glass.border
          }}
        >
          <div className="p-4">
            
            {/* Languages Section */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3" style={{ color: theme.colors.text.primary }}>
                🌐 Language
              </h3>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`text-left px-3 py-2 text-xs rounded hover:opacity-80 transition-all ${
                      language === lang.code ? 'font-semibold' : ''
                    }`}
                    style={{
                      backgroundColor: language === lang.code ? theme.colors.accent + '20' : theme.colors.surface,
                      color: language === lang.code ? theme.colors.accent : theme.colors.text.primary
                    }}
                  >
                    <div className="truncate">{lang.nativeName}</div>
                    <div className="text-xs opacity-70 truncate">{lang.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Currencies Section */}
            <div>
              <h3 className="text-sm font-semibold mb-3" style={{ color: theme.colors.text.primary }}>
                💱 Currency
              </h3>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {SUPPORTED_CURRENCIES.map((curr) => {
                  const info = CURRENCY_NAMES[curr] || { name: curr, symbol: curr }
                  return (
                    <button
                      key={curr}
                      onClick={() => handleCurrencyChange(curr)}
                      className={`text-left px-3 py-2 text-xs rounded hover:opacity-80 transition-all ${
                        currency === curr ? 'font-semibold' : ''
                      }`}
                      style={{
                        backgroundColor: currency === curr ? theme.colors.accent + '20' : theme.colors.surface,
                        color: currency === curr ? theme.colors.accent : theme.colors.text.primary
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span>{info.symbol}</span>
                        <span className="truncate">{curr}</span>
                      </div>
                      <div className="text-xs opacity-70 truncate">{info.name}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Close Button */}
            <div className="mt-4 pt-3 border-t" style={{ borderColor: theme.colors.glass.border }}>
              <button
                onClick={() => setIsDropdownOpen(false)}
                className="w-full py-2 text-sm rounded transition-all hover:opacity-80"
                style={{
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text.secondary
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isDropdownOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
    </div>
  )
}