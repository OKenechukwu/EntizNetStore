import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// GET - Fetch user's wishlist
export async function GET(request: NextRequest) {
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

    // Fetch wishlist items with product details
    const { data: wishlistItems, error } = await supabase
      .from('wishlists')
      .select(`
        id,
        product_id,
        variant_id,
        created_at,
        product:products(
          id,
          title,
          slug,
          base_price,
          compare_at_price,
          marketplace_brand,
          media:product_media(url, alt_text)
        ),
        variant:product_variants(
          id,
          title,
          price,
          compare_at_price
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching wishlist:', error)
      throw new Error('Failed to fetch wishlist')
    }

    // Process the items to add computed fields
    const processedItems = (wishlistItems || []).map(item => ({
      ...item,
      product: item.product ? {
        ...item.product,
        image_url: item.product.media?.[0]?.url || null,
        current_price: item.variant?.price || item.product.base_price,
        original_price: item.variant?.compare_at_price || item.product.compare_at_price
      } : null
    }))

    return NextResponse.json({
      items: processedItems,
      count: processedItems.length
    })

  } catch (error: any) {
    console.error('Wishlist GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch wishlist' },
      { status: 500 }
    )
  }
}

// POST - Add item to wishlist
export async function POST(request: NextRequest) {
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

    const { product_id, variant_id } = await request.json()

    if (!product_id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      )
    }

    // Check if item already exists in wishlist
    const { data: existing } = await supabase
      .from('wishlists')
      .select('id')
      .eq('user_id', user.id)
      .eq('product_id', product_id)
      .eq('variant_id', variant_id || null)
      .single()

    if (existing) {
      return NextResponse.json(
        { message: 'Item already in wishlist' },
        { status: 200 }
      )
    }

    // Add to wishlist
    const { data: newItem, error } = await supabase
      .from('wishlists')
      .insert({
        user_id: user.id,
        product_id,
        variant_id: variant_id || null
      })
      .select(`
        id,
        product_id,
        variant_id,
        created_at,
        product:products(
          id,
          title,
          slug,
          base_price,
          compare_at_price,
          media:product_media(url, alt_text)
        )
      `)
      .single()

    if (error) {
      console.error('Error adding to wishlist:', error)
      throw new Error('Failed to add item to wishlist')
    }

    // Process the item
    const processedItem = {
      ...newItem,
      product: newItem.product ? {
        ...newItem.product,
        image_url: newItem.product.media?.[0]?.url || null
      } : null
    }

    return NextResponse.json({
      item: processedItem,
      message: 'Item added to wishlist'
    })

  } catch (error: any) {
    console.error('Wishlist POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add to wishlist' },
      { status: 500 }
    )
  }
}

// DELETE - Remove item from wishlist
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

    const { product_id, variant_id } = await request.json()

    if (!product_id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      )
    }

    // Remove from wishlist
    const { error } = await supabase
      .from('wishlists')
      .delete()
      .eq('user_id', user.id)
      .eq('product_id', product_id)
      .eq('variant_id', variant_id || null)

    if (error) {
      console.error('Error removing from wishlist:', error)
      throw new Error('Failed to remove from wishlist')
    }

    return NextResponse.json({
      message: 'Item removed from wishlist'
    })

  } catch (error: any) {
    console.error('Wishlist DELETE error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to remove from wishlist' },
      { status: 500 }
    )
  }
}