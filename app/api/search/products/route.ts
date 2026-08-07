import { NextRequest, NextResponse } from 'next/server'
import { searchProducts } from '@/lib/data/products'

export const dynamic = 'force-dynamic'

// Product search backed by the live Neon Postgres database (see lib/db.ts).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      query,
      filters,
      marketplace_brand = 'entiznetstore',
      limit,
    } = body ?? {}

    const products = await searchProducts({
      queryText: typeof query === 'string' ? query : undefined,
      marketplaceBrand: marketplace_brand || undefined,
      minPrice: filters?.priceRange?.min,
      maxPrice:
        filters?.priceRange?.max != null && filters.priceRange.max < 1000
          ? filters.priceRange.max
          : undefined,
      minRating:
        Array.isArray(filters?.ratings) && filters.ratings.length > 0
          ? Math.min(...filters.ratings)
          : undefined,
      onSale: Boolean(filters?.onSale),
      limit: typeof limit === 'number' ? limit : 50,
    })

    return NextResponse.json({ products })
  } catch (error: any) {
    console.error('Product search failed:', error)
    return NextResponse.json(
      { error: 'Product search failed' },
      { status: 500 }
    )
  }
}
