import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { searchParams } = new URL(request.url)
    const brand = searchParams.get('brand') || 'entiznetstore'
    
    // Verify trusted admin (server-validated user + app_metadata role)
    const { errorResponse } = await requireAdmin()
    if (errorResponse) return errorResponse

    // For now, return mock activity data
    // In production, this would query an activity/audit log table
    
    const generateMockActivity = () => {
      const activities = []
      const types = ['order', 'user', 'product', 'review'] as const
      const baseTime = new Date()
      
      for (let i = 0; i < 20; i++) {
        const type = types[Math.floor(Math.random() * types.length)]
        const timestamp = new Date(baseTime.getTime() - (i * 30 * 60 * 1000)) // 30 min intervals
        
        let description = ''
        let status = undefined
        
        switch (type) {
          case 'order':
            const orderActions = [
              'New order placed for premium collection',
              'Order #12345 marked as shipped',
              'Payment processed for order #12346',
              'Order #12347 completed successfully'
            ]
            description = orderActions[Math.floor(Math.random() * orderActions.length)]
            status = ['completed', 'pending', 'shipped'][Math.floor(Math.random() * 3)]
            break
            
          case 'user':
            const userActions = brand === 'primediscreet' ? [
              'Elite user registered with verification',
              'User completed KYC verification',
              'Premium member upgraded account',
              'User requested account deletion'
            ] : [
              'New user registered',
              'User updated profile information',
              'User verified email address',
              'User login from new device detected'
            ]
            description = userActions[Math.floor(Math.random() * userActions.length)]
            break
            
          case 'product':
            const productActions = brand === 'primediscreet' ? [
              'Elite product added to collection',
              'Premium item approved for listing',
              'Luxury product inventory updated',
              'Artisan product featured on homepage'
            ] : [
              'New product added to catalog',
              'Product inventory updated',
              'Product marked as featured',
              'Product description updated'
            ]
            description = productActions[Math.floor(Math.random() * productActions.length)]
            break
            
          case 'review':
            const reviewActions = [
              '5-star review submitted for product',
              'Review approved after moderation',
              'Customer feedback flagged for review',
              'Seller response added to review'
            ]
            description = reviewActions[Math.floor(Math.random() * reviewActions.length)]
            status = ['approved', 'pending', 'flagged'][Math.floor(Math.random() * 3)]
            break
        }
        
        activities.push({
          id: `activity_${i}`,
          type,
          description,
          timestamp: timestamp.toISOString(),
          status
        })
      }
      
      return activities
    }

    const activities = generateMockActivity()

    return NextResponse.json({
      activities,
      total: activities.length
    })

  } catch (error: any) {
    console.error('Admin activity error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch admin activity' },
      { status: 500 }
    )
  }
}