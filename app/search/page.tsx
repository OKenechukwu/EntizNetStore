'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useBrand } from '@/components/BrandProvider'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'

interface Product {
  id: string
  name: string
  description: string
  price: number
  image_url?: string
  slug: string
  rating?: number
  reviews_count?: number
  marketplace_brand?: string
}

function SearchResults() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''
  const { theme, brand } = useBrand()
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([])
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const supabase = createClientComponentClient()

  useEffect(() => {
    if (query) {
      performSearch(query)
    }
  }, [query, brand])

  const performSearch = async (searchQuery: string) => {
    setLoading(true)
    setHasSearched(true)
    
    try {
      // Search for products
      const response = await fetch('/api/search/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          marketplace_brand: brand
        })
      })

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      setSearchResults(data.products || [])
      
      // Load related and recommended products
      await Promise.all([
        loadRelatedProducts(searchQuery),
        loadRecommendedProducts()
      ])
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
    } finally {
      setLoading(false)
    }
  }

  const loadRelatedProducts = async (searchQuery: string) => {
    try {
      // Get products from similar categories or with related keywords
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .ilike('name', `%${searchQuery.split(' ')[0]}%`)
        .eq('marketplace_brand', brand)
        .limit(6)

      if (!error && data) {
        setRelatedProducts(data.filter(p => !searchResults.some(sr => sr.id === p.id)))
      }
    } catch (error) {
      console.error('Error loading related products:', error)
    }
  }

  const loadRecommendedProducts = async () => {
    try {
      // Get top-rated or popular products
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('marketplace_brand', brand)
        .order('created_at', { ascending: false })
        .limit(6)

      if (!error && data) {
        setRecommendedProducts(data.filter(p => !searchResults.some(sr => sr.id === p.id)))
      }
    } catch (error) {
      console.error('Error loading recommended products:', error)
    }
  }

  const ProductCard = ({ product }: { product: Product }) => (
    <Link href={`/store/${product.id}`} className="group">
      <div className="border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300"
           style={{ borderColor: theme.colors.glass.border }}>
        
        {/* Product Image */}
        <div className="aspect-square bg-gray-100 relative">
          {product.image_url ? (
            <img 
              src={product.image_url} 
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center"
                 style={{ backgroundColor: theme.colors.surface }}>
              <span className="text-4xl opacity-50">📦</span>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="p-4">
          <h3 className="font-semibold text-sm line-clamp-2 mb-2 group-hover:opacity-80 transition-opacity"
              style={{ color: theme.colors.text.primary }}>
            {product.name}
          </h3>
          
          <p className="text-xs line-clamp-2 mb-3" style={{ color: theme.colors.text.secondary }}>
            {product.description}
          </p>

          <div className="flex items-center justify-between">
            <span className="font-bold" style={{ color: theme.colors.accent }}>
              ${product.price}
            </span>
            
            {product.rating && (
              <div className="flex items-center gap-1">
                <span className="text-xs" style={{ color: theme.colors.accent }}>★</span>
                <span className="text-xs" style={{ color: theme.colors.text.secondary }}>
                  {product.rating} ({product.reviews_count || 0})
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  )

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.colors.background }}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Search Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: theme.colors.text.primary }}>
            {query ? `Search Results` : 'Search Products'}
          </h1>
          {query && (
            <p className="text-lg" style={{ color: theme.colors.text.secondary }}>
              {loading ? 'Searching...' : 
               searchResults.length > 0 ? 
                 `Found ${searchResults.length} results for "${query}"` : 
                 hasSearched ? `No results found for "${query}"` : ''
              }
            </p>
          )}
        </div>

        {/* No Results Message */}
        {hasSearched && searchResults.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
              Cannot find this product
            </h2>
            <p className="text-lg mb-6" style={{ color: theme.colors.text.secondary }}>
              We couldn't find any products matching "{query}". Try a different search term or browse our categories.
            </p>
            <Link 
              href="/categories"
              className="inline-block px-6 py-3 rounded-lg font-medium transition-all hover:opacity-90"
              style={{
                backgroundColor: theme.colors.accent,
                color: brand === 'primediscreet' ? theme.colors.background : 'white'
              }}
            >
              Browse Categories
            </Link>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, index) => (
              <div key={index} className="border rounded-lg overflow-hidden animate-pulse"
                   style={{ borderColor: theme.colors.glass.border }}>
                <div className="aspect-square" style={{ backgroundColor: theme.colors.surface }}></div>
                <div className="p-4 space-y-2">
                  <div className="h-4 rounded" style={{ backgroundColor: theme.colors.surface }}></div>
                  <div className="h-3 rounded w-3/4" style={{ backgroundColor: theme.colors.surface }}></div>
                  <div className="h-4 rounded w-1/2" style={{ backgroundColor: theme.colors.surface }}></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && !loading && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold mb-6" style={{ color: theme.colors.text.primary }}>
              Search Results ({searchResults.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {searchResults.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold mb-6" style={{ color: theme.colors.text.primary }}>
              Related Products
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {relatedProducts.slice(0, 4).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}

        {/* Recommended Products */}
        {recommendedProducts.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold mb-6" style={{ color: theme.colors.text.primary }}>
              Recommended Products
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {recommendedProducts.slice(0, 4).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}

        {/* Empty State - No query */}
        {!query && !loading && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
              Start Your Search
            </h2>
            <p className="text-lg mb-6" style={{ color: theme.colors.text.secondary }}>
              Use the search bar above to find products, or browse our categories.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/categories"
                className="px-6 py-3 rounded-lg font-medium transition-all hover:opacity-90"
                style={{
                  backgroundColor: theme.colors.accent,
                  color: brand === 'primediscreet' ? theme.colors.background : 'white'
                }}
              >
                Browse Categories
              </Link>
              <Link 
                href="/store"
                className="px-6 py-3 rounded-lg font-medium border transition-all hover:opacity-80"
                style={{
                  borderColor: theme.colors.accent,
                  color: theme.colors.accent
                }}
              >
                View All Products
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-current border-t-transparent rounded-full"></div>
      </div>
    }>
      <SearchResults />
    </Suspense>
  )
}