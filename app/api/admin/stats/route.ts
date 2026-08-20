import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const PERIOD_DAYS: Record<string, number> = {
  '1d': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await requireAdmin()
    if (errorResponse) return errorResponse

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '7d'
    const brand = searchParams.get('brand') || 'entiznetstore'
    const days = PERIOD_DAYS[period] ?? PERIOD_DAYS['7d']
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const supabase = getSupabaseAdmin()

    const [ordersResult, productsResult, buyersResult, sellersResult] = await Promise.all([
      supabase
        .from('orders')
        .select('total_cents, payment_status, status')
        .gte('created_at', startDate)
        .contains('metadata', { marketplace_brand: brand }),
      supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('marketplace_brand', brand)
        .eq('status', 'active'),
      supabase.from('profiles_buyer').select('id'),
      supabase.from('profiles_seller').select('id'),
    ])

    const firstError = [
      ordersResult.error,
      productsResult.error,
      buyersResult.error,
      sellersResult.error,
    ].find(Boolean)
    if (firstError) throw firstError

    const orders = ordersResult.data ?? []
    const paidOrders = orders.filter((order) => order.payment_status === 'paid')
    const totalRevenueCents = paidOrders.reduce(
      (sum, order) => sum + Number(order.total_cents ?? 0),
      0,
    )
    const userIds = new Set([
      ...(buyersResult.data ?? []).map((profile) => profile.id),
      ...(sellersResult.data ?? []).map((profile) => profile.id),
    ])

    return NextResponse.json({
      totalRevenue: totalRevenueCents / 100,
      totalOrders: orders.length,
      totalUsers: userIds.size,
      totalProducts: productsResult.count ?? 0,
      pendingOrders: orders.filter((order) => order.status === 'pending').length,
      // These require analytics/session instrumentation. Report zero until collected.
      activeUsers: 0,
      conversionRate: 0,
      avgOrderValue: paidOrders.length
        ? totalRevenueCents / paidOrders.length / 100
        : 0,
    })
  } catch (error: any) {
    console.error('Admin stats error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch admin stats' },
      { status: 500 },
    )
  }
}
