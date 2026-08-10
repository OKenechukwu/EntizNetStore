import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { review_id, action, reason } = await request.json()

    if (!review_id || !action) {
      return NextResponse.json({ error: 'Review ID and action are required' }, { status: 400 })
    }

    if (!['approve', 'reject', 'flag'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Verify trusted admin (server-validated user + app_metadata role)
    const { user, errorResponse } = await requireAdmin()
    if (errorResponse) return errorResponse

    const supabase = createServerComponentClient({ cookies })

    // Get the current review
    const { data: review, error: reviewError } = await supabase
      .from('product_reviews')
      .select('*')
      .eq('id', review_id)
      .single()

    if (reviewError || !review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    // Update review status
    const newStatus = action === 'approve' ? 'approved' : 
                    action === 'reject' ? 'rejected' : 'flagged'

    const { error: updateError } = await supabase
      .from('product_reviews')
      .update({
        status: newStatus,
        moderated_at: new Date().toISOString(),
        moderated_by: user.id,
        moderation_reason: reason || null
      })
      .eq('id', review_id)

    if (updateError) throw updateError

    // If approved, update product statistics
    if (action === 'approve') {
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/reviews/update-product-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: review.product_id })
      })
    }

    // Log moderation action
    const { error: logError } = await supabase
      .from('moderation_logs')
      .insert({
        content_type: 'product_review',
        content_id: review_id,
        action: action,
        reason: reason,
        moderator_id: user.id,
        created_at: new Date().toISOString()
      })

    if (logError) {
      console.error('Error logging moderation action:', logError)
      // Don't fail the request for logging errors
    }

    return NextResponse.json({
      success: true,
      message: `Review ${action}ed successfully`,
      review_id,
      new_status: newStatus
    })

  } catch (error: any) {
    console.error('Error moderating review:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to moderate review' },
      { status: 500 }
    )
  }
}