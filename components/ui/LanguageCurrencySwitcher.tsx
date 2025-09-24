'use client'

import { useState } from 'react'
import { useBrand } from '@/components/BrandProvider'
import LanguageSwitcher from './LanguageSwitcher'
import CurrencySwitcher from './CurrencySwitcher'

interface LanguageCurrencySwitcherProps {
  className?: string
  showLabels?: boolean
}

export default function LanguageCurrencySwitcher({
  className = "",
  showLabels = false
}: LanguageCurrencySwitcherProps) {
  const { theme } = useBrand()
  const [currentLanguage, setCurrentLanguage] = useState('en')
  const [currentCurrency, setCurrentCurrency] = useState('USD')

  const handleLanguageChange = (language: string) => {
    setCurrentLanguage(language)
    // In a real app, this would trigger route changes and locale switching
    console.log('Language changed to:', language)
  }

  const handleCurrencyChange = (currency: string) => {
    setCurrentCurrency(currency)
    // In a real app, this would update price displays throughout the app
    console.log('Currency changed to:', currency)
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {showLabels && (
        <div className="hidden md:flex items-center gap-4 mr-2">
          <span className="text-sm font-medium" style={{ color: theme.colors.text.secondary }}>
            Language & Currency:
          </span>
        </div>
      )}
      
      {/* Language Switcher */}
      <LanguageSwitcher
        currentLanguage={currentLanguage}
        onLanguageChange={handleLanguageChange}
      />
      
      {/* Separator */}
      <div className="w-px h-6 hidden sm:block" 
           style={{ backgroundColor: theme.colors.glass.border }}>
      </div>
      
      {/* Currency Switcher */}
      <CurrencySwitcher
        currentCurrency={currentCurrency}
        onCurrencyChange={handleCurrencyChange}
      />
    </div>
  )
}