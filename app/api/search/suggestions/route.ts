import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { query, marketplace_brand = 'entiznetstore' } = await request.json()

    if (!query || query.length < 2) {
      return NextResponse.json({ suggestions: [] })
    }

    const supabase = createServerComponentClient({ cookies })

    // Get product title suggestions
    const { data: productSuggestions } = await supabase
      .from('products')
      .select('title, tags, search_keywords')
      .eq('marketplace_brand', marketplace_brand)
      .eq('status', 'active')
      .ilike('title', `%${query}%`)
      .limit(5)

    // Get category suggestions (static for now)
    const categoryKeywords = [
      'vibrators', 'dildos', 'toys', 'men', 'anal', 'couples', 'bdsm', 'fetish',
      'lubes', 'essentials', 'lingerie', 'apparel', 'gift sets', 'bundles'
    ]
    
    const categorySuggestions = categoryKeywords
      .filter(keyword => keyword.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 3)

    // Get brand suggestions
    const brandKeywords = [
      'LELO', 'We-Vibe', 'Satisfyer', 'CalExotics', 'Dame', 'MysteryVibe',
      ...(marketplace_brand === 'primediscreet' ? ['Elite Artisan', 'Premium Select'] : [])
    ]
    
    const brandSuggestions = brandKeywords
      .filter(brand => brand.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 2)

    // Get trending search terms (static for now)
    const trendingTerms = marketplace_brand === 'primediscreet' ? [
      'elite vibrators', 'premium couples toys', 'luxury lingerie', 'artisan collections',
      'discrete shipping', 'high-end massagers', 'premium materials', 'exclusive designs'
    ] : [
      'waterproof vibrators', 'couples massage', 'beginner friendly', 'rechargeable toys',
      'app controlled', 'remote control', 'hands free', 'travel size'
    ]

    const trendingSuggestions = trendingTerms
      .filter(term => term.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 2)

    // Combine suggestions with priorities
    let suggestions: string[] = []

    // Add exact product title matches first
    if (productSuggestions) {
      const productTitles = productSuggestions
        .map(p => p.title)
        .filter(title => title.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 3)
      suggestions.push(...productTitles)
    }

    // Add category suggestions
    suggestions.push(...categorySuggestions)

    // Add brand suggestions
    suggestions.push(...brandSuggestions)

    // Add trending suggestions
    suggestions.push(...trendingSuggestions)

    // Add popular search completions
    const popularCompletions = generatePopularCompletions(query, marketplace_brand)
    suggestions.push(...popularCompletions.slice(0, 2))

    // Remove duplicates and limit
    const uniqueSuggestions = [...new Set(suggestions)]
      .filter(s => s.toLowerCase() !== query.toLowerCase())
      .slice(0, 8)

    return NextResponse.json({
      suggestions: uniqueSuggestions,
      query
    })

  } catch (error: any) {
    console.error('Search suggestions error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate suggestions' },
      { status: 500 }
    )
  }
}

function generatePopularCompletions(query: string, marketplace_brand: string): string[] {
  const queryLower = query.toLowerCase()
  
  const completions = marketplace_brand === 'primediscreet' ? {
    'vib': ['vibrators elite', 'vibrator premium', 'vibrating luxury'],
    'toy': ['toys for couples elite', 'toy premium collection', 'toys luxury'],
    'mas': ['massager premium', 'massage oil luxury', 'massagers elite'],
    'lin': ['lingerie premium', 'lingerie luxury', 'lingerie elite'],
    'coup': ['couples toys elite', 'couples premium', 'couples luxury'],
    'pre': ['premium collection', 'premium toys', 'premium massagers'],
    'ele': ['elite vibrators', 'elite collection', 'elite toys'],
    'lux': ['luxury toys', 'luxury collection', 'luxury vibrators']
  } : {
    'vib': ['vibrators waterproof', 'vibrator rechargeable', 'vibrating toys'],
    'toy': ['toys for couples', 'toy beginner', 'toys waterproof'],
    'mas': ['massager wand', 'massage oil', 'massagers rechargeable'],
    'rem': ['remote control', 'remote vibrator', 'remote toys'],
    'wat': ['waterproof toys', 'waterproof vibrator', 'water based'],
    'rec': ['rechargeable toys', 'rechargeable vibrator', 'rechargeable massager'],
    'app': ['app controlled', 'app controlled vibrator', 'app controlled toys'],
    'beg': ['beginner friendly', 'beginner toys', 'beginner vibrator']
  }

  for (const [prefix, options] of Object.entries(completions)) {
    if (queryLower.startsWith(prefix)) {
      return options.filter(option => option.toLowerCase().includes(queryLower))
    }
  }

  return []
}