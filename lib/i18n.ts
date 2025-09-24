// Internationalization configuration for EntizNetStore
import { notFound } from 'next/navigation'
import { getRequestConfig } from 'next-intl/server'

export type Locale = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh' | 'ar'

// All supported locales
export const locales: Locale[] = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ar']

// Default locale
export const defaultLocale: Locale = 'en'

export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale as Locale)) notFound()

  return {
    messages: (await import(`../messages/${locale}.json`)).default
  }
})