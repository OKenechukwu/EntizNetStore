'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useBrand } from '@/components/BrandProvider'

interface Language {
  code: string
  name: string
  nativeName: string
  flag: string
}

interface LanguageSwitcherProps {
  currentLanguage?: string
  onLanguageChange?: (language: string) => void
  className?: string
}

const languages: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' }
]

export default function LanguageSwitcher({
  currentLanguage = 'en',
  onLanguageChange,
  className = ""
}: LanguageSwitcherProps) {
  const { theme } = useBrand()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentLang = languages.find(lang => lang.code === selectedLanguage) || languages[0]

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

  const handleLanguageSelect = (languageCode: string) => {
    setSelectedLanguage(languageCode)
    setIsOpen(false)
    
    // Call external handler if provided
    if (onLanguageChange) {
      onLanguageChange(languageCode)
    }
    
    // Store in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('entiznet-language', languageCode)
    }
    
    // In a real app, this would trigger a route change or reload
    // For now, we'll just log the change
    console.log(`Language changed to: ${languageCode}`)
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
        aria-label="Select language"
        aria-expanded={isOpen}
      >
        <span className="text-lg">{currentLang.flag}</span>
        <span className="text-sm font-medium hidden sm:inline">
          {currentLang.nativeName}
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
            className="absolute top-full right-0 mt-2 w-64 rounded-xl border shadow-xl backdrop-blur-sm z-50 overflow-hidden"
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.glass.border,
              boxShadow: theme.colors.shadow.luxury
            }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b"
                 style={{ borderColor: theme.colors.glass.border }}>
              <h3 className="text-sm font-semibold" style={{ color: theme.colors.text.primary }}>
                Select Language
              </h3>
            </div>

            {/* Language List */}
            <div className="max-h-80 overflow-y-auto">
              {languages.map((language, index) => (
                <motion.button
                  key={language.code}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => handleLanguageSelect(language.code)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 hover:bg-brandPink/10 ${
                    selectedLanguage === language.code ? 'bg-brandPink/10' : ''
                  }`}
                >
                  {/* Flag */}
                  <span className="text-xl">{language.flag}</span>
                  
                  {/* Language Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium" style={{ color: theme.colors.text.primary }}>
                        {language.nativeName}
                      </span>
                      {selectedLanguage === language.code && (
                        <svg className="w-4 h-4 text-brandPink" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm" style={{ color: theme.colors.text.secondary }}>
                      {language.name}
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t text-center"
                 style={{ borderColor: theme.colors.glass.border }}>
              <p className="text-xs" style={{ color: theme.colors.text.secondary }}>
                More languages coming soon
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}