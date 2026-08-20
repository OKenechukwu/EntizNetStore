'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useBrand } from '@/components/BrandProvider'

interface SearchSuggestion {
  id: string
  type: 'product' | 'category' | 'brand'
  title: string
  category?: string
  price?: number
  image?: string
  href: string
}

interface ProductSearchBarProps {
  placeholder?: string
  className?: string
  autoFocus?: boolean
  showSuggestions?: boolean
}

export default function ProductSearchBar({
  placeholder = "What are you looking for today?",
  className = "",
  autoFocus = false,
  showSuggestions = true
}: ProductSearchBarProps) {
  const { theme } = useBrand()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSelectedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSuggestions([])
      return
    }

    setIsLoading(true)
    
    try {
      const response = await fetch('/api/search/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          marketplace_brand: 'entiznetstore',
          limit: 6,
        }),
      })
      if (!response.ok) throw new Error('Search request failed')

      const payload = await response.json()
      const realSuggestions: SearchSuggestion[] = (payload.products ?? []).map((product: any) => ({
        id: product.id,
        type: 'product' as const,
        title: product.title,
        price: Number(product.base_price),
        image: product.image_url,
        href: `/products/${product.slug}`,
      }))
      setSuggestions(realSuggestions)
    } catch (error) {
      console.error('Product suggestions failed:', error)
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    setSelectedIndex(-1)
    
    if (showSuggestions) {
      performSearch(value)
    }
  }

  const handleInputFocus = () => {
    setIsOpen(true)
    if (query && showSuggestions) {
      performSearch(query)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
      setIsOpen(false)
      inputRef.current?.blur()
    }
  }

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    router.push(suggestion.href)
    setIsOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        )
        break
      case 'Enter':
        if (selectedIndex >= 0) {
          e.preventDefault()
          handleSuggestionClick(suggestions[selectedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSelectedIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'product':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        )
      case 'category':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        )
      case 'brand':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z" />
          </svg>
        )
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )
    }
  }

  return (
    <div ref={containerRef} className={`relative w-full max-w-2xl mx-auto ${className}`}>
      {/* Search Form */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            role="combobox"
            aria-label="Search products and categories"
            aria-expanded={isOpen && suggestions.length > 0}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            aria-activedescendant={selectedIndex >= 0 ? `search-suggestion-${selectedIndex}` : undefined}
            aria-describedby="search-help"
            className="w-full h-14 pl-6 pr-16 rounded-2xl border-2 text-lg transition-all duration-300 focus:outline-none focus:ring-4"
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: isOpen ? theme.colors.accent : theme.colors.glass.border,
              color: theme.colors.text.primary
            }}
          />
          
          {/* Screen reader helper text */}
          <div id="search-help" className="sr-only">
            Search through products, categories, and brands. Use arrow keys to navigate suggestions, Enter to select, Escape to close.
          </div>
          
          {/* Search Icon / Loading */}
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin"
                   style={{ color: theme.colors.accent }}></div>
            ) : (
              <button
                type="submit"
                className="w-10 h-10 rounded-full bg-brandPink hover:bg-brandPink-600 text-white flex items-center justify-center transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                aria-label="Search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Search Suggestions */}
      <AnimatePresence>
        {isOpen && showSuggestions && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 mt-2 rounded-2xl border shadow-2xl backdrop-blur-sm z-50 overflow-hidden"
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.glass.border,
              boxShadow: theme.colors.shadow.luxury
            }}
          >
            {suggestions.length > 0 ? (
              <div 
                role="listbox"
                aria-label="Search suggestions"
                className="max-h-96 overflow-y-auto"
              >
                {suggestions.map((suggestion, index) => (
                  <motion.button
                    key={suggestion.id}
                    id={`search-suggestion-${index}`}
                    role="option"
                    aria-selected={selectedIndex === index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={`w-full flex items-center gap-4 p-4 text-left transition-all duration-200 hover:bg-brandPink/10 ${
                      selectedIndex === index ? 'bg-brandPink/10' : ''
                    }`}
                    aria-label={`${suggestion.type}: ${suggestion.title}${suggestion.category ? ` in ${suggestion.category}` : ''}${suggestion.price ? ` - $${suggestion.price}` : ''}`}
                  >
                    {/* Icon */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brandPink/20 flex items-center justify-center"
                         style={{ color: theme.colors.accent }}>
                      {getSuggestionIcon(suggestion.type)}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate"
                              style={{ color: theme.colors.text.primary }}>
                          {suggestion.title}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full bg-brandPink/20 text-brandPink capitalize">
                          {suggestion.type}
                        </span>
                      </div>
                      {suggestion.category && (
                        <div className="text-sm mt-1" style={{ color: theme.colors.text.secondary }}>
                          in {suggestion.category}
                        </div>
                      )}
                      {suggestion.price && (
                        <div className="text-sm font-medium mt-1" style={{ color: theme.colors.accent }}>
                          ${suggestion.price}
                        </div>
                      )}
                    </div>
                    
                    {/* Arrow */}
                    <div className="flex-shrink-0" style={{ color: theme.colors.text.secondary }} aria-hidden="true">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </motion.button>
                ))}
              </div>
            ) : query.length > 0 && !isLoading ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-4 opacity-40">🔍</div>
                <p className="text-lg font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  No results found
                </p>
                <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
                  Try searching for different keywords
                </p>
              </div>
            ) : query.length === 0 && suggestions.length === 0 ? (
              <div className="p-6">
                <div className="text-sm font-medium mb-3" style={{ color: theme.colors.text.primary }}>
                  Popular searches
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Vibrators', 'Luxury', 'Wellness', 'Massage', 'Premium'].map((term) => (
                    <button
                      key={term}
                      onClick={() => {
                        setQuery(term)
                        performSearch(term)
                      }}
                      className="px-3 py-1 rounded-full text-sm bg-brandPink/10 text-brandPink hover:bg-brandPink/20 transition-colors"
                      aria-label={`Search for ${term}`}
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
