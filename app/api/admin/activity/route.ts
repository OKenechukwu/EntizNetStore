import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

type Activity = {
  id: string
  type: 'order' | 'product' | 'review'
  description: string
  timestamp: string
  status?: string
}

const safeTimestamp = (value: string | null) => value ?? new Date(0).toISOString()

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await requireAdmin()
    if (errorResponse) return errorResponse

    const { searchParams } = new URL(request.url)
    const brand = searchParams.get('brand') || 'entiznetstore'
    const supabase = getSupabaseAdmin()

    const [ordersResult, productsResult, reviewsResult] = await Promise.all([
      supabase
        .from('orders')
        .select('id, order_number, status, payment_status, created_at')
        .contains('metadata', { marketplace_brand: brand })
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('products')
        .select('id, title, status, created_at')
        .eq('marketplace_brand', brand)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('reviews')
        .select('id, rating, status, created_at, products!inner(marketplace_brand)')
        .eq('products.marketplace_brand', brand)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    const firstError = [ordersResult.error, productsResult.error, reviewsResult.error].find(Boolean)
    if (firstError) throw firstError

    const activities: Activity[] = [
      ...(ordersResult.data ?? []).map((order) => ({
        id: `order_${order.id}`,
        type: 'order' as const,
        description: `Order ${order.order_number} was placed`,
        timestamp: safeTimestamp(order.created_at),
        status: order.payment_status === 'paid' ? order.status : order.payment_status,
      })),
      ...(productsResult.data ?? []).map((product) => ({
        id: `product_${product.id}`,
        type: 'product' as const,
        description: `Product “${product.title}” was added`,
        timestamp: safeTimestamp(product.created_at),
        status: product.status,
      })),
      ...(reviewsResult.data ?? []).map((review) => ({
        id: `review_${review.id}`,
        type: 'review' as const,
        description: `${review.rating}-star review submitted`,
        timestamp: safeTimestamp(review.created_at),
        status: review.status,
      })),
    ]
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, 20)

    return NextResponse.json({ activities, total: activities.length })
  } catch (error: any) {
    console.error('Admin activity error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch admin activity' },
      { status: 500 },
    )
  }
}
