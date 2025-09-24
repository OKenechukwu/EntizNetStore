import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, filters, marketplace_brand = 'entiznetstore' } = body

    const supabase = createServerComponentClient({ cookies })

    // Build the search query
    let searchQuery = supabase
      .from('products')
      .select(`
        id,
        name,
        description,
        base_price,
        compare_at_price,
        status,
        marketplace_brand,
        tags,
        search_keywords,
        average_rating,
        review_count,
        created_at,
        updated_at
      `)

    // Add marketplace brand filter
    if (marketplace_brand) {
      searchQuery = searchQuery.eq('marketplace_brand', marketplace_brand)
    }

    // Add text search if query provided
    if (query && query.trim()) {
      // Search in title, description, and tags
      searchQuery = searchQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%,tags.cs.{${query}},search_keywords.cs.{${query}}`)
    }

    // Apply category filters
    if (filters?.categories && filters.categories.length > 0) {
      // For now, simulate category filtering with tags
      const categoryTags = filters.categories.join(',')
      searchQuery = searchQuery.overlaps('tags', filters.categories)
    }

    // Apply price range filters
    if (filters?.priceRange) {
      if (filters.priceRange.min > 0) {
        searchQuery = searchQuery.gte('base_price', filters.priceRange.min)
      }
      if (filters.priceRange.max < 1000) {
        searchQuery = searchQuery.lte('base_price', filters.priceRange.max)
      }
    }

    // Apply rating filters
    if (filters?.ratings && filters.ratings.length > 0) {
      const minRating = Math.min(...filters.ratings)
      searchQuery = searchQuery.gte('average_rating', minRating)
    }

    // Apply status filters
    searchQuery = searchQuery.eq('status', 'active')

    // Apply quick filters
    if (filters?.inStock) {
      // For now, assume products with variants have stock
      // In real implementation, you'd check variant inventory
    }

    if (filters?.onSale) {
      searchQuery = searchQuery.not('compare_at_price', 'is', null)
    }

    if (filters?.newArrivals) {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      searchQuery = searchQuery.gte('created_at', thirtyDaysAgo.toISOString())
    }

    // Apply sorting
    switch (filters?.sortBy) {
      case 'newest':
        searchQuery = searchQuery.order('created_at', { ascending: false })
        break
      case 'price_low':
        searchQuery = searchQuery.order('base_price', { ascending: true })
        break
      case 'price_high':
        searchQuery = searchQuery.order('base_price', { ascending: false })
        break
      case 'rating':
        searchQuery = searchQuery.order('average_rating', { ascending: false })
        break
      case 'popularity':
        searchQuery = searchQuery.order('review_count', { ascending: false })
        break
      case 'elite_featured':
        if (marketplace_brand === 'primediscreet') {
          searchQuery = searchQuery.order('base_price', { ascending: false })
        }
        break
      default: // relevance
        if (query && query.trim()) {
          // For relevance, we'd typically use full-text search ranking
          // For now, order by updated_at desc as a proxy
          searchQuery = searchQuery.order('updated_at', { ascending: false })
        } else {
          searchQuery = searchQuery.order('created_at', { ascending: false })
        }
    }

    // Limit results
    searchQuery = searchQuery.limit(50)

    const { data: products, error } = await searchQuery

    if (error) {
      console.error('Search error:', error)
      throw new Error('Search failed')
    }

    // Process results to add computed fields
    const processedProducts = (products || []).map(product => ({
      ...product,
      image_url: null, // No media relationship for now
      price: product.base_price,
      on_sale: product.compare_at_price && product.compare_at_price > product.base_price,
      rating: product.average_rating || 0,
      reviews_count: product.review_count || 0,
      slug: product.id
    }))

    // Add search analytics (optional)
    if (query && query.trim()) {
      try {
        await supabase
          .from('search_analytics')
          .insert({
            query: query.trim(),
            marketplace_brand,
            result_count: processedProducts.length,
            filters_applied: filters,
            created_at: new Date().toISOString()
          })
      } catch (analyticsError) {
        // Don't fail the search if analytics fails
        console.error('Search analytics error:', analyticsError)
      }
    }

    return NextResponse.json({
      products: processedProducts,
      total: processedProducts.length,
      query,
      filters
    })

  } catch (error: any) {
    console.error('Product search error:', error)
    return NextResponse.json(
      { error: error.message || 'Search failed' },
      { status: 500 }
    )
  }
}

function getProductPriceRange(product: any) {
  if (!product.variants || product.variants.length === 0) {
    return {
      min: product.base_price,
      max: product.base_price
    }
  }

  const prices = product.variants.map((v: any) => v.price)
  return {
    min: Math.min(...prices),
    max: Math.max(...prices)
  }
}