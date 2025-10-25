'use client'

import { useState, useEffect } from 'react'
import { useBrand } from '@/components/BrandProvider'
import { getSupabaseClient } from '@/lib/supabase/client'
import ReviewForm from './ReviewForm'
import { useI18n } from '@/components/i18n/I18nProvider'

interface ProductReviewsProps {
  productId: string
  sellerId: string
  showWriteReview?: boolean
}

export default function ProductReviews({
  productId,
  sellerId,
  showWriteReview = true
}: ProductReviewsProps) {
  const { brand, theme } = useBrand()
  const { t } = useI18n()
  const [reviews, setReviews] = useState<any[]>([])
  const [reviewStats, setReviewStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [sortBy, setSortBy] = useState('newest')
  const [filterBy, setFilterBy] = useState('all')
  const supabase = getSupabaseClient()

  useEffect(() => {
    loadReviews()
    loadReviewStats()
  }, [productId, sortBy, filterBy])

  const loadReviews = async () => {
    try {
      let query = supabase
        .from('product_reviews')
        .select(
          `
          *,
          buyer:profiles!buyer_id(username, avatar_url)
        `
        )
        .eq('product_id', productId)
        .eq('status', 'approved')

      // Apply filters
      if (filterBy !== 'all') {
        query = query.eq('rating', parseInt(filterBy))
      }

      // Apply sorting
      switch (sortBy) {
        case 'newest':
          query = query.order('created_at', { ascending: false })
          break
        case 'oldest':
          query = query.order('created_at', { ascending: true })
          break
        case 'highest_rated':
          query = query.order('rating', { ascending: false })
          break
        case 'lowest_rated':
          query = query.order('rating', { ascending: true })
          break
        case 'most_helpful':
          query = query.order('helpful_count', { ascending: false })
          break
      }

      const { data, error } = await query

      if (error) throw error
      setReviews(data || [])
    } catch (error) {
      console.error('Error loading reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadReviewStats = async () => {
    try {
      const { data, error } = await supabase
        .from('product_review_stats')
        .select('*')
        .eq('product_id', productId)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      setReviewStats(data)
    } catch (error) {
      console.error('Error loading review stats:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const StarDisplay = ({ rating, size = 'small' }: { rating: number; size?: 'small' | 'large' }) => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={size === 'large' ? 'text-xl' : 'text-sm'}
          style={{ color: star <= rating ? theme.colors.accent : theme.colors.text.secondary }}
        >
          ★
        </span>
      ))}
    </div>
  )

  const RatingBreakdown = () => {
    if (!reviewStats || reviewStats.total_reviews === 0) return null

    const ratingCounts = {
      5: reviewStats.five_star_count || 0,
      4: reviewStats.four_star_count || 0,
      3: reviewStats.three_star_count || 0,
      2: reviewStats.two_star_count || 0,
      1: reviewStats.one_star_count || 0
    }

    return (
      <div className="space-y-2">
        {[5, 4, 3, 2, 1].map((rating) => (
          <div key={rating} className="flex items-center gap-3">
            <span className="text-sm w-6" style={{ color: theme.colors.text.primary }}>
              {rating}★
            </span>
            <div
              className="flex-1 h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: theme.colors.background }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  backgroundColor: theme.colors.accent,
                  width: `${
                    (ratingCounts[rating as keyof typeof ratingCounts] / reviewStats.total_reviews) *
                    100
                  }%`
                }}
              />
            </div>
            <span className="text-sm w-8 text-right" style={{ color: theme.colors.text.secondary }}>
              {ratingCounts[rating as keyof typeof ratingCounts]}
            </span>
          </div>
        ))}
      </div>
    )
  }

  const ReviewCard = ({ review }: { review: any }) => (
    <div className="p-6 border rounded-lg" style={{ borderColor: theme.colors.glass.border }}>
      {/* Review Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: theme.colors.accent }}
          >
            <span className="text-white font-semibold">
              {review.buyer?.username?.[0]?.toUpperCase() || 'A'}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <span className="font-medium" style={{ color: theme.colors.text.primary }}>
                {review.buyer?.username || 'Anonymous'}
              </span>
              <StarDisplay rating={review.rating} />
              <span className="text-sm" style={{ color: theme.colors.text.secondary }}>
                {formatDate(review.created_at)}
              </span>
            </div>
            {review.title && (
              <h4 className="font-medium mt-1" style={{ color: theme.colors.text.primary }}>
                {review.title}
              </h4>
            )}
          </div>
        </div>

        {review.would_recommend && <div className="text-green-500 text-sm">✓ Recommends</div>}
      </div>

      {/* Review Content */}
      <div className="mb-4">
        <p style={{ color: theme.colors.text.primary }}>{review.content}</p>
      </div>

      {/* Review Images */}
      {review.images && review.images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {review.images.map((imageUrl: string, index: number) => (
            <img
              key={index}
              src={imageUrl}
              alt={`Review image ${index + 1}`}
              className="w-20 h-20 object-cover rounded-lg border"
              style={{ borderColor: theme.colors.glass.border }}
            />
          ))}
        </div>
      )}

      {/* Seller Rating */}
      {review.seller_rating && (
        <div
          className="p-3 rounded border-l-4 mb-4"
          style={{
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.accent
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium" style={{ color: theme.colors.text.primary }}>
              Seller Service:
            </span>
            <StarDisplay rating={review.seller_rating} />
          </div>
          {review.seller_feedback && (
            <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
              {review.seller_feedback}
            </p>
          )}
        </div>
      )}

      {/* Review Actions */}
      <div className="flex items-center gap-4 text-sm">
        <button className="flex items-center gap-1 hover:opacity-80 transition-opacity">
          <span>👍</span>
          <span style={{ color: theme.colors.text.secondary }}>
            Helpful ({review.helpful_count || 0})
          </span>
        </button>
        <button className="flex items-center gap-1 hover:opacity-80 transition-opacity">
          <span>💬</span>
          <span style={{ color: theme.colors.text.secondary }}>Reply</span>
        </button>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div
          className="animate-spin w-8 h-8 border-4 border-current border-t-transparent rounded-full"
          style={{ color: theme.colors.accent }}
        ></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Review Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="text-center">
          <div className="text-4xl font-bold mb-2" style={{ color: theme.colors.accent }}>
            {reviewStats?.average_rating?.toFixed(1) || '0.0'}
          </div>
          <StarDisplay rating={Math.round(reviewStats?.average_rating || 0)} size="large" />
          <div className="text-sm mt-2" style={{ color: theme.colors.text.secondary }}>
            Based on {reviewStats?.total_reviews || 0}{' '}
            {brand === 'primediscreet' ? 'elite reviews' : 'reviews'}
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-4" style={{ color: theme.colors.text.primary }}>
            Rating Breakdown
          </h4>
          <RatingBreakdown />
        </div>
      </div>

      {/* Write Review */}
      {showWriteReview && (
        <div className="border-t pt-8" style={{ borderColor: theme.colors.glass.border }}>
          {!showReviewForm ? (
            <div className="text-center">
              <button
                onClick={() => setShowReviewForm(true)}
                className="px-6 py-3 rounded-lg font-semibold transition-all"
                style={{
                  backgroundColor: theme.colors.accent,
                  color:
                    brand === 'primediscreet'
                      ? theme.colors.background
                      : theme.colors.text.primary
                }}
              >
                {brand === 'primediscreet' ? 'Write Elite Review' : 'Write a Review'}
              </button>
            </div>
          ) : (
            <ReviewForm
              productId={productId}
              sellerId={sellerId}
              onSubmit={() => {
                setShowReviewForm(false)
                loadReviews()
                loadReviewStats()
              }}
              onCancel={() => setShowReviewForm(false)}
            />
          )}
        </div>
      )}

      {/* Filter and Sort */}
      {reviews.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-4 pb-4 border-b"
          style={{ borderColor: theme.colors.glass.border }}
        >
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium" style={{ color: theme.colors.text.primary }}>
              Sort by:
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1 border rounded focus:outline-none focus:ring-2"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.glass.border,
                color: theme.colors.text.primary
              }}
            >
              <option value="newest">{t('search.sort.newest_first')}</option>
              <option value="oldest">{t('search.sort.oldest')}</option>
              <option value="highest_rated">{t('search.sort.highest_rated')}</option>
              <option value="lowest_rated">{t('search.sort.lowest_rated')}</option>
              <option value="most_helpful">{t('search.sort.most_helpful')}</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium" style={{ color: theme.colors.text.primary }}>
              Filter:
            </label>
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value)}
              className="px-3 py-1 border rounded focus:outline-none focus:ring-2"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.glass.border,
                color: theme.colors.text.primary
              }}
            >
              <option value="all">{t('search.sort.all_ratings')}</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
          </div>
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-6">
        {reviews.length > 0 ? (
          reviews.map((review) => <ReviewCard key={review.id} review={review} />)
        ) : (
          <div className="text-center py-12">
            <div className="text-4xl mb-4" style={{ color: theme.colors.text.secondary }}>
              ⭐
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
              No reviews yet
            </h3>
            <p style={{ color: theme.colors.text.secondary }}>
              {brand === 'primediscreet'
                ? 'Be the first to share your elite experience with this product'
                : 'Be the first to review this product and help others make informed decisions'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
