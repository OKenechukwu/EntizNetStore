import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '7d'
    const brand = searchParams.get('brand') || 'entiznetstore'
    
    // Verify trusted admin (server-validated user + app_metadata role)
    const { errorResponse } = await requireAdmin()
    if (errorResponse) return errorResponse

    // For now, return mock data since we're building the foundation
    // In a real implementation, this would query the actual database
    
    const getDaysFromPeriod = (period: string): number => {
      switch (period) {
        case '1d': return 1
        case '7d': return 7
        case '30d': return 30
        case '90d': return 90
        default: return 7
      }
    }

    const days = getDaysFromPeriod(period)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Mock calculations based on period and brand
    const baseMultiplier = brand === 'primediscreet' ? 2.5 : 1.0
    const periodMultiplier = days / 7 // Scale by period length

    const mockStats = {
      totalRevenue: Math.round(25000 * baseMultiplier * periodMultiplier),
      totalOrders: Math.round(450 * periodMultiplier),
      totalUsers: Math.round(2800 * baseMultiplier),
      totalProducts: Math.round(150 * baseMultiplier),
      pendingOrders: Math.round(23 * Math.min(periodMultiplier, 2)),
      activeUsers: Math.round(890 * baseMultiplier * Math.min(periodMultiplier, 1.5)),
      conversionRate: brand === 'primediscreet' ? 4.2 : 3.1,
      avgOrderValue: Math.round(180 * baseMultiplier)
    }

    try {
      // Try to get some real data from the database where possible
      
      // Get total products count
      const { count: productsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('marketplace_brand', brand)
        .eq('status', 'active')

      if (productsCount !== null) {
        mockStats.totalProducts = productsCount
      }

      // Get total users count (approximate from auth.users)
      // Note: In production, you'd want a dedicated analytics table
      
    } catch (dbError) {
      console.error('Database query error:', dbError)
      // Continue with mock data if database queries fail
    }

    return NextResponse.json(mockStats)

  } catch (error: any) {
    console.error('Admin stats error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch admin stats' },
      { status: 500 }
    )
  }
}