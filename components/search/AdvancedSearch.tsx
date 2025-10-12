'use client'

import { useState, useEffect, useRef } from 'react'
import { useBrand } from '@/components/BrandProvider'
import { getSupabaseClient } from '@/lib/supabase/client'

interface AdvancedSearchProps {
  onResults?: (results: any[]) => void
  onFiltersChange?: (filters: any) => void
  initialQuery?: string
  compact?: boolean
}

export default function AdvancedSearch({ 
  onResults, 
  onFiltersChange, 
  initialQuery = '', 
  compact = false 
}: AdvancedSearchProps) {
  const { brand, theme } = useBrand()
  const [query, setQuery] = useState(initialQuery)
  const [filters, setFilters] = useState({
    categories: [] as string[],
    priceRange: { min: 0, max: 1000 },
    ratings: [] as number[],
    brands: [] as string[],
    sortBy: 'relevance',
    inStock: false,
    freeShipping: false,
    newArrivals: false,
    onSale: false
  })
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(!compact)
  const [categories, setCategories] = useState<any[]>([])
  const [availableBrands, setAvailableBrands] = useState<any[]>([])
  const debounceRef = useRef<NodeJS.Timeout>()
  const supabase = getSupabaseClient()

  useEffect(() => {
    loadCategories()
    loadBrands()
  }, [])

  useEffect(() => {
    if (query.length >= 2) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      debounceRef.current = setTimeout(() => {
        performSearch()
        generateSuggestions()
      }, 300)
    } else {
      setSuggestions([])
      if (query.length === 0) {
        setSearchResults([])
        if (onResults) onResults([])
      }
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, filters])

  const loadCategories = async () => {
    try {
      // For now, use static categories until database is properly set up
      const staticCategories = [
        { id: '1', name: 'Vibrators', slug: 'vibrators' },
        { id: '2', name: 'Dildos & Toys', slug: 'dildos-toys' },
        { id: '3', name: 'Men\'s Toys', slug: 'mens-toys' },
        { id: '4', name: 'Anal Toys', slug: 'anal-toys' },
        { id: '5', name: 'Couples\' Toys', slug: 'couples-toys' },
        { id: '6', name: 'BDSM & Fetish', slug: 'bdsm-fetish' },
        { id: '7', name: 'Lubes & Essentials', slug: 'lubes-essentials' },
        { id: '8', name: 'Lingerie & Apparel', slug: 'lingerie-apparel' },
        ...(brand === 'primediscreet' ? [
          { id: '9', name: 'Elite Collections', slug: 'elite-collections' },
          { id: '10', name: 'Premium Artisan', slug: 'premium-artisan' }
        ] : [])
      ]
      setCategories(staticCategories)
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  const loadBrands = async () => {
    try {
      // For now, use static brands
      const staticBrands = [
        { id: '1', name: 'LELO', slug: 'lelo' },
        { id: '2', name: 'We-Vibe', slug: 'we-vibe' },
        { id: '3', name: 'Satisfyer', slug: 'satisfyer' },
        { id: '4', name: 'CalExotics', slug: 'calexotics' },
        ...(brand === 'primediscreet' ? [
          { id: '5', name: 'Elite Artisan', slug: 'elite-artisan' },
          { id: '6', name: 'Premium Select', slug: 'premium-select' }
        ] : [])
      ]
      setAvailableBrands(staticBrands)
    } catch (error) {
      console.error('Error loading brands:', error)
    }
  }

  const performSearch = async () => {
    setLoading(true)
    
    try {
      const response = await fetch('/api/search/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          filters,
          marketplace_brand: brand
        })
      })

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      setSearchResults(data.products || [])
      if (onResults) {
        onResults(data.products || [])
      }
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
      if (onResults) onResults([])
    } finally {
      setLoading(false)
    }
  }

  const generateSuggestions = async () => {
    if (query.length < 2) return

    try {
      const response = await fetch('/api/search/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query, 
          marketplace_brand: brand 
        })
      })

      const data = await response.json()
      setSuggestions(data.suggestions || [])
    } catch (error) {
      console.error('Error generating suggestions:', error)
      setSuggestions([])
    }
  }

  const updateFilters = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    if (onFiltersChange) {
      onFiltersChange(newFilters)
    }
  }

  const toggleCategoryFilter = (categoryId: string) => {
    const newCategories = filters.categories.includes(categoryId)
      ? filters.categories.filter(id => id !== categoryId)
      : [...filters.categories, categoryId]
    updateFilters('categories', newCategories)
  }

  const toggleRatingFilter = (rating: number) => {
    const newRatings = filters.ratings.includes(rating)
      ? filters.ratings.filter(r => r !== rating)
      : [...filters.ratings, rating]
    updateFilters('ratings', newRatings)
  }

  const clearAllFilters = () => {
    const clearedFilters = {
      categories: [],
      priceRange: { min: 0, max: 1000 },
      ratings: [],
      brands: [],
      sortBy: 'relevance',
      inStock: false,
      freeShipping: false,
      newArrivals: false,
      onSale: false
    }
    setFilters(clearedFilters)
    if (onFiltersChange) {
      onFiltersChange(clearedFilters)
    }
  }

  const activeFiltersCount = 
    filters.categories.length + 
    filters.ratings.length + 
    filters.brands.length + 
    (filters.inStock ? 1 : 0) + 
    (filters.freeShipping ? 1 : 0) + 
    (filters.newArrivals ? 1 : 0) + 
    (filters.onSale ? 1 : 0)

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={brand === 'primediscreet' 
              ? 'Search elite collection...' 
              : 'Search products...'
            }
            className="w-full px-4 py-3 pl-12 border rounded-lg focus:outline-none focus:ring-2 text-lg"
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.glass.border,
              color: theme.colors.text.primary
            }}
          />
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
            <span className="text-xl" style={{ color: theme.colors.accent }}>🔍</span>
          </div>
          {loading && (
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full"
                   style={{ color: theme.colors.accent }}></div>
            </div>
          )}
        </div>

        {/* Search Suggestions */}
        {suggestions.length > 0 && query.length >= 2 && (
          <div className="absolute top-full left-0 right-0 mt-1 border rounded-lg shadow-lg z-50"
               style={{ 
                 backgroundColor: theme.colors.surface,
                 borderColor: theme.colors.glass.border 
               }}>
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => setQuery(suggestion)}
                className="w-full px-4 py-2 text-left hover:bg-opacity-80 transition-colors"
                style={{ 
                  backgroundColor: 'transparent',
                  color: theme.colors.text.primary
                }}
              >
                🔍 {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filter Toggle */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg transition-all"
          style={{
            borderColor: theme.colors.glass.border,
            color: theme.colors.text.primary
          }}
        >
          <span>🎛️</span>
          <span>Filters</span>
          {activeFiltersCount > 0 && (
            <span className="px-2 py-1 rounded-full text-xs font-bold"
                  style={{ 
                    backgroundColor: theme.colors.accent,
                    color: brand === 'primediscreet' ? theme.colors.background : 'white'
                  }}>
              {activeFiltersCount}
            </span>
          )}
        </button>

        {activeFiltersCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="text-sm underline hover:opacity-80 transition-opacity"
            style={{ color: theme.colors.accent }}
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 border rounded-lg"
             style={{ 
               backgroundColor: theme.colors.surface,
               borderColor: theme.colors.glass.border 
             }}>
          
          {/* Categories */}
          <div>
            <h3 className="font-semibold mb-3" style={{ color: theme.colors.text.primary }}>
              Categories
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {categories.map(category => (
                <label key={category.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.categories.includes(category.id)}
                    onChange={() => toggleCategoryFilter(category.id)}
                    className="rounded"
                  />
                  <span style={{ color: theme.colors.text.primary }}>
                    {category.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div>
            <h3 className="font-semibold mb-3" style={{ color: theme.colors.text.primary }}>
              Price Range
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={filters.priceRange.min}
                  onChange={(e) => updateFilters('priceRange', {
                    ...filters.priceRange,
                    min: parseInt(e.target.value) || 0
                  })}
                  placeholder="Min"
                  className="w-20 px-2 py-1 border rounded text-sm"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                />
                <span style={{ color: theme.colors.text.secondary }}>to</span>
                <input
                  type="number"
                  value={filters.priceRange.max}
                  onChange={(e) => updateFilters('priceRange', {
                    ...filters.priceRange,
                    max: parseInt(e.target.value) || 1000
                  })}
                  placeholder="Max"
                  className="w-20 px-2 py-1 border rounded text-sm"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                />
              </div>
              
              {/* Quick Price Ranges */}
              <div className="flex flex-wrap gap-1">
                {[
                  { label: 'Under $25', min: 0, max: 25 },
                  { label: '$25-50', min: 25, max: 50 },
                  { label: '$50-100', min: 50, max: 100 },
                  { label: '$100+', min: 100, max: 1000 }
                ].map(range => (
                  <button
                    key={range.label}
                    onClick={() => updateFilters('priceRange', { min: range.min, max: range.max })}
                    className="px-2 py-1 text-xs border rounded hover:bg-opacity-80 transition-colors"
                    style={{
                      borderColor: theme.colors.glass.border,
                      color: theme.colors.text.secondary
                    }}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Ratings */}
          <div>
            <h3 className="font-semibold mb-3" style={{ color: theme.colors.text.primary }}>
              Customer Rating
            </h3>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map(rating => (
                <label key={rating} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.ratings.includes(rating)}
                    onChange={() => toggleRatingFilter(rating)}
                    className="rounded"
                  />
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <span 
                        key={star}
                        className="text-sm"
                        style={{ 
                          color: star <= rating ? theme.colors.accent : theme.colors.text.secondary 
                        }}
                      >
                        ★
                      </span>
                    ))}
                    <span className="text-sm" style={{ color: theme.colors.text.secondary }}>
                      & up
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Quick Filters */}
          <div>
            <h3 className="font-semibold mb-3" style={{ color: theme.colors.text.primary }}>
              Quick Filters
            </h3>
            <div className="space-y-2">
              {[
                { key: 'inStock', label: 'In Stock' },
                { key: 'freeShipping', label: 'Free Shipping' },
                { key: 'newArrivals', label: 'New Arrivals' },
                { key: 'onSale', label: 'On Sale' }
              ].map(filter => (
                <label key={filter.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters[filter.key as keyof typeof filters] as boolean}
                    onChange={(e) => updateFilters(filter.key, e.target.checked)}
                    className="rounded"
                  />
                  <span style={{ color: theme.colors.text.primary }}>
                    {filter.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Sort By */}
          <div>
            <h3 className="font-semibold mb-3" style={{ color: theme.colors.text.primary }}>
              Sort By
            </h3>
            <select
              value={filters.sortBy}
              onChange={(e) => updateFilters('sortBy', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
              style={{
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.glass.border,
                color: theme.colors.text.primary
              }}
            >
              <option value="relevance">Relevance</option>
              <option value="newest">Newest First</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
              <option value="rating">Customer Rating</option>
              <option value="popularity">Popularity</option>
              {brand === 'primediscreet' && (
                <option value="elite_featured">Elite Featured</option>
              )}
            </select>
          </div>
        </div>
      )}

      {/* Search Results Count */}
      {searchResults.length > 0 && (
        <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
          Found {searchResults.length} {brand === 'primediscreet' ? 'elite products' : 'products'}
          {query && ` for "${query}"`}
        </div>
      )}
    </div>
  )
}