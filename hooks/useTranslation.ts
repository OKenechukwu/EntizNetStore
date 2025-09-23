// hooks/useTranslation.ts
import { useState, useEffect } from 'react'
import { getTranslation, type TranslationKey } from '@/lib/translations'
import { getLanguageFromCookie } from '@/lib/languages'

export function useTranslation() {
  const [language, setLanguage] = useState('en')

  useEffect(() => {
    // Get language from cookie on mount
    const savedLanguage = getLanguageFromCookie()
    setLanguage(savedLanguage)

    // Listen for cookie changes
    const interval = setInterval(() => {
      const currentLanguage = getLanguageFromCookie()
      if (currentLanguage !== language) {
        setLanguage(currentLanguage)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [language])

  const t = (key: TranslationKey): string => {
    return getTranslation(key, language)
  }

  return { t, language }
}