import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// DELETE - Clear entire wishlist
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Clear all wishlist items for user
    const { error } = await supabase
      .from('wishlists')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      console.error('Error clearing wishlist:', error)
      throw new Error('Failed to clear wishlist')
    }

    return NextResponse.json({
      message: 'Wishlist cleared successfully'
    })

  } catch (error: any) {
    console.error('Clear wishlist error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to clear wishlist' },
      { status: 500 }
    )
  }
}