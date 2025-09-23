import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { product_id } = await request.json()

    if (!product_id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    const supabase = createServerComponentClient({ cookies })

    // Calculate review statistics for the product
    const { data: reviews, error: reviewsError } = await supabase
      .from('product_reviews')
      .select('rating, seller_rating')
      .eq('product_id', product_id)
      .eq('status', 'approved')

    if (reviewsError) {
      throw new Error('Failed to fetch reviews')
    }

    if (!reviews || reviews.length === 0) {
      // No reviews yet, create/update with zero stats
      const { error: upsertError } = await supabase
        .from('product_review_stats')
        .upsert({
          product_id,
          total_reviews: 0,
          average_rating: 0,
          average_seller_rating: 0,
          one_star_count: 0,
          two_star_count: 0,
          three_star_count: 0,
          four_star_count: 0,
          five_star_count: 0,
          updated_at: new Date().toISOString()
        })

      if (upsertError) throw upsertError

      return NextResponse.json({ success: true, stats: null })
    }

    // Calculate statistics
    const totalReviews = reviews.length
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0)
    const averageRating = totalRating / totalReviews

    const sellerRatings = reviews.filter(r => r.seller_rating).map(r => r.seller_rating)
    const averageSellerRating = sellerRatings.length > 0 
      ? sellerRatings.reduce((sum, rating) => sum + rating, 0) / sellerRatings.length 
      : null

    // Count ratings by star level
    const ratingCounts = {
      one_star_count: reviews.filter(r => r.rating === 1).length,
      two_star_count: reviews.filter(r => r.rating === 2).length,
      three_star_count: reviews.filter(r => r.rating === 3).length,
      four_star_count: reviews.filter(r => r.rating === 4).length,
      five_star_count: reviews.filter(r => r.rating === 5).length
    }

    // Update or create review stats
    const { error: upsertError } = await supabase
      .from('product_review_stats')
      .upsert({
        product_id,
        total_reviews: totalReviews,
        average_rating: averageRating,
        average_seller_rating: averageSellerRating,
        ...ratingCounts,
        updated_at: new Date().toISOString()
      })

    if (upsertError) throw upsertError

    // Also update the main products table with quick access rating
    const { error: productUpdateError } = await supabase
      .from('products')
      .update({
        average_rating: averageRating,
        review_count: totalReviews,
        updated_at: new Date().toISOString()
      })
      .eq('id', product_id)

    if (productUpdateError) {
      console.error('Error updating product rating:', productUpdateError)
      // Don't fail the request for this
    }

    return NextResponse.json({
      success: true,
      stats: {
        total_reviews: totalReviews,
        average_rating: averageRating,
        average_seller_rating: averageSellerRating,
        ...ratingCounts
      }
    })

  } catch (error: any) {
    console.error('Error updating product stats:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update product stats' },
      { status: 500 }
    )
  }
}