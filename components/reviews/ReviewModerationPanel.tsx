'use client'

import { useState, useEffect } from 'react'
import { useBrand } from '@/components/BrandProvider'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface ReviewModerationPanelProps {
  isAdmin?: boolean
}

export default function ReviewModerationPanel({ isAdmin = false }: ReviewModerationPanelProps) {
  const { brand, theme } = useBrand()
  const [pendingReviews, setPendingReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [moderating, setModerating] = useState<string | null>(null)
  const [filter, setFilter] = useState('pending_moderation')
  const supabase = createClientComponentClient()

  useEffect(() => {
    if (isAdmin) {
      loadPendingReviews()
    }
  }, [isAdmin, filter])

  const loadPendingReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('product_reviews')
        .select(`
          *,
          buyer:profiles!buyer_id(username, email),
          product:products(title, marketplace_brand),
          seller:profiles!seller_id(username)
        `)
        .eq('status', filter)
        .order('created_at', { ascending: true })

      if (error) throw error
      setPendingReviews(data || [])
    } catch (error) {
      console.error('Error loading pending reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  const moderateReview = async (reviewId: string, action: string, reason?: string) => {
    setModerating(reviewId)

    try {
      const response = await fetch('/api/reviews/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_id: reviewId,
          action,
          reason
        })
      })

      const result = await response.json()

      if (result.error) {
        throw new Error(result.error)
      }

      // Remove from pending list
      setPendingReviews(prev => prev.filter(review => review.id !== reviewId))
      
      alert(`Review ${action}ed successfully`)

    } catch (error: any) {
      alert(`Failed to ${action} review: ${error.message}`)
    } finally {
      setModerating(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const StarDisplay = ({ rating }: { rating: number }) => (
    <div className="flex">
      {[1, 2, 3, 4, 5].map(star => (
        <span 
          key={star}
          className="text-sm"
          style={{ color: star <= rating ? theme.colors.accent : theme.colors.text.secondary }}
        >
          ★
        </span>
      ))}
    </div>
  )

  if (!isAdmin) {
    return (
      <div className="text-center py-8">
        <p style={{ color: theme.colors.text.secondary }}>
          Admin access required
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-current border-t-transparent rounded-full"
             style={{ color: theme.colors.accent }}></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
          {brand === 'primediscreet' ? 'Elite Review Moderation' : 'Review Moderation'}
        </h2>
        
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.glass.border,
            color: theme.colors.text.primary
          }}
        >
          <option value="pending_moderation">Pending Moderation</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="flagged">Flagged</option>
        </select>
      </div>

      {pendingReviews.length > 0 ? (
        <div className="space-y-4">
          {pendingReviews.map(review => (
            <div key={review.id} className="border rounded-lg p-6"
                 style={{ borderColor: theme.colors.glass.border }}>
              
              {/* Review Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-medium" style={{ color: theme.colors.text.primary }}>
                      {review.buyer?.username || 'Anonymous'}
                    </span>
                    <StarDisplay rating={review.rating} />
                    <span className="text-sm" style={{ color: theme.colors.text.secondary }}>
                      {formatDate(review.created_at)}
                    </span>
                  </div>
                  
                  <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
                    Product: <span style={{ color: theme.colors.text.primary }}>
                      {review.product?.title}
                    </span>
                    <span className="mx-2">•</span>
                    Brand: <span className="capitalize">
                      {review.product?.marketplace_brand === 'primediscreet' 
                        ? 'Prime Discreet' 
                        : 'EntizNet Store'
                      }
                    </span>
                  </div>
                </div>
                
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  review.status === 'pending_moderation' ? 'bg-yellow-100 text-yellow-800' :
                  review.status === 'approved' ? 'bg-green-100 text-green-800' :
                  review.status === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {review.status.replace('_', ' ').toUpperCase()}
                </div>
              </div>

              {/* Review Content */}
              <div className="mb-4">
                {review.title && (
                  <h4 className="font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                    {review.title}
                  </h4>
                )}
                <p style={{ color: theme.colors.text.primary }}>
                  {review.content}
                </p>
              </div>

              {/* Seller Rating */}
              {review.seller_rating && (
                <div className="mb-4 p-3 rounded" style={{ backgroundColor: theme.colors.background }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium" style={{ color: theme.colors.text.primary }}>
                      Seller Rating:
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

              {/* Review Images */}
              {review.images && review.images.length > 0 && (
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2">
                    {review.images.map((imageUrl: string, index: number) => (
                      <img
                        key={index}
                        src={imageUrl}
                        alt={`Review image ${index + 1}`}
                        className="w-16 h-16 object-cover rounded border"
                        style={{ borderColor: theme.colors.glass.border }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Moderation Actions */}
              {review.status === 'pending_moderation' && (
                <div className="flex items-center gap-3 pt-4 border-t"
                     style={{ borderColor: theme.colors.glass.border }}>
                  <button
                    onClick={() => moderateReview(review.id, 'approve')}
                    disabled={moderating === review.id}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {moderating === review.id ? 'Processing...' : 'Approve'}
                  </button>
                  
                  <button
                    onClick={() => {
                      const reason = prompt('Reason for rejection (optional):')
                      if (reason !== null) {
                        moderateReview(review.id, 'reject', reason)
                      }
                    }}
                    disabled={moderating === review.id}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                  
                  <button
                    onClick={() => {
                      const reason = prompt('Reason for flagging:')
                      if (reason) {
                        moderateReview(review.id, 'flag', reason)
                      }
                    }}
                    disabled={moderating === review.id}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition-colors disabled:opacity-50"
                  >
                    Flag
                  </button>
                </div>
              )}

              {/* Moderation Info */}
              {review.moderated_at && (
                <div className="mt-4 text-sm" style={{ color: theme.colors.text.secondary }}>
                  Moderated on {formatDate(review.moderated_at)}
                  {review.moderation_reason && (
                    <span> • Reason: {review.moderation_reason}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-4xl mb-4" style={{ color: theme.colors.text.secondary }}>📋</div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
            No {filter.replace('_', ' ')} reviews
          </h3>
          <p style={{ color: theme.colors.text.secondary }}>
            {filter === 'pending_moderation' 
              ? 'All reviews have been moderated'
              : `No reviews found with status: ${filter.replace('_', ' ')}`
            }
          </p>
        </div>
      )}
    </div>
  )
}