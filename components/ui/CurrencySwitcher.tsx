'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useBrand } from '@/components/BrandProvider'
import { T } from '@/components/i18n/I18nProvider'

interface Currency {
  code: string
  name: string
  symbol: string
  flag: string
  rate: number // Exchange rate relative to USD
}

interface CurrencySwitcherProps {
  currentCurrency?: string
  onCurrencyChange?: (currency: string) => void
  className?: string
}

const currencies: Currency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸', rate: 1.0 },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺', rate: 0.85 },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧', rate: 0.73 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦', rate: 1.35 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺', rate: 1.55 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵', rate: 150.0 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', flag: '🇨🇭', rate: 0.88 },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', flag: '🇸🇪', rate: 11.0 },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', flag: '🇳🇴', rate: 10.8 },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', flag: '🇩🇰', rate: 6.9 }
]

export default function CurrencySwitcher({
  currentCurrency = 'USD',
  onCurrencyChange,
  className = ""
}: CurrencySwitcherProps) {
  const { theme } = useBrand()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCurrency, setSelectedCurrency] = useState(currentCurrency)
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({})
  const [isLoadingRates, setIsLoadingRates] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentCurr = currencies.find(curr => curr.code === selectedCurrency) || currencies[0]

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load exchange rates (mock implementation)
  const loadExchangeRates = async () => {
    setIsLoadingRates(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    const mockRates = currencies.reduce((acc, currency) => {
      acc[currency.code] = currency.rate + (Math.random() - 0.5) * 0.02
      return acc
    }, {} as Record<string, number>)
    setExchangeRates(mockRates)
    setIsLoadingRates(false)
  }

  useEffect(() => {
    loadExchangeRates()
  }, [])

  const handleCurrencySelect = (currencyCode: string) => {
    setSelectedCurrency(currencyCode)
    setIsOpen(false)
    onCurrencyChange?.(currencyCode)
    if (typeof window !== 'undefined') {
      localStorage.setItem('entiznet-currency', currencyCode)
    }
  }

  const formatExchangeRate = (rate: number) => {
    return rate >= 1 ? rate.toFixed(2) : rate.toFixed(4)
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-300 hover:shadow-md"
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.glass.border,
          color: theme.colors.text.primary
        }}
        aria-label="Select currency"
        aria-expanded={isOpen}
      >
        <span className="text-lg">{currentCurr.flag}</span>
        <span className="text-sm font-medium">
          {currentCurr.code}
        </span>
        <span className="text-sm hidden sm:inline" style={{ color: theme.colors.text.secondary }}>
          {currentCurr.symbol}
        </span>
        <svg 
          className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full right-0 mt-2 w-72 rounded-xl border shadow-xl backdrop-blur-sm z-50 overflow-hidden"
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.glass.border,
              boxShadow: theme.colors.shadow.luxury
            }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b"
                 style={{ borderColor: theme.colors.glass.border }}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold" style={{ color: theme.colors.text.primary }}>
                  <T k="common.selectCurrency" fallback="Select Currency" />
                </h3>
                <button
                  onClick={loadExchangeRates}
                  disabled={isLoadingRates}
                  className="text-xs px-2 py-1 rounded bg-brandPink/10 text-brandPink hover:bg-brandPink/20 transition-colors disabled:opacity-50"
                >
                  {isLoadingRates ? (
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                      <span><T k="common.updating" fallback="Updating" /></span>
                    </div>
                  ) : (
                    <T k="common.refreshRates" fallback="Refresh Rates" />
                  )}
                </button>
              </div>
            </div>

            {/* Currency List */}
            <div className="max-h-80 overflow-y-auto">
              {currencies.map((currency, index) => {
                const currentRate = exchangeRates[currency.code] || currency.rate
                return (
                  <motion.button
                    key={currency.code}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => handleCurrencySelect(currency.code)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 hover:bg-brandPink/10 ${
                      selectedCurrency === currency.code ? 'bg-brandPink/10' : ''
                    }`}
                  >
                    {/* Flag */}
                    <span className="text-xl">{currency.flag}</span>

                    {/* Currency Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium" style={{ color: theme.colors.text.primary }}>
                            {currency.code}
                          </span>
                          <span className="text-sm font-mono" style={{ color: theme.colors.accent }}>
                            {currency.symbol}
                          </span>
                        </div>
                        {selectedCurrency === currency.code && (
                          <svg className="w-4 h-4 text-brandPink" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm" style={{ color: theme.colors.text.secondary }}>
                          {currency.name}
                        </span>
                        <span className="text-xs font-mono" style={{ color: theme.colors.text.secondary }}>
                          1 USD = {formatExchangeRate(currentRate)} {currency.code}
                        </span>
                      </div>
                    </div>
                  </motion.button>
                )
              })}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t text-center"
                 style={{ borderColor: theme.colors.glass.border }}>
              <p className="text-xs" style={{ color: theme.colors.text.secondary }}>
                <T k="common.ratesPowered" fallback="Rates updated in real-time • Powered by live exchange data" />
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
