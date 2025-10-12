'use client'

import { useState } from 'react'
import { useBrand } from '@/components/BrandProvider'
import { getSupabaseClient } from '@/lib/supabase/client'

interface ReviewFormProps {
  productId: string
  sellerId: string
  orderId?: string
  onSubmit?: (review: any) => void
  onCancel?: () => void
}

export default function ReviewForm({ 
  productId, 
  sellerId, 
  orderId, 
  onSubmit, 
  onCancel 
}: ReviewFormProps) {
  const { brand, theme } = useBrand()
  const [formData, setFormData] = useState({
    rating: 0,
    title: '',
    content: '',
    wouldRecommend: true,
    sellerRating: 0,
    sellerFeedback: '',
    images: [] as File[]
  })
  const [hoveredRating, setHoveredRating] = useState(0)
  const [hoveredSellerRating, setHoveredSellerRating] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const supabase = getSupabaseClient()

  const ratingLabels = {
    1: 'Poor',
    2: 'Fair', 
    3: 'Good',
    4: 'Very Good',
    5: 'Excellent'
  }

  const handleImageUpload = (files: FileList) => {
    const newImages = Array.from(files).slice(0, 5) // Max 5 images
    setFormData(prev => ({ ...prev, images: newImages }))
  }

  const uploadImages = async (reviewId: string) => {
    if (formData.images.length === 0) return []

    const uploadPromises = formData.images.map(async (file, index) => {
      const fileExt = file.name.split('.').pop()
      const fileName = `reviews/${reviewId}/${index}.${fileExt}`

      const { data, error } = await supabase.storage
        .from('review-images')
        .upload(fileName, file)

      if (error) throw error

      const { data: urlData } = supabase.storage
        .from('review-images')
        .getPublicUrl(fileName)

      return urlData.publicUrl
    })

    return Promise.all(uploadPromises)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.rating === 0) {
      alert('Please select a product rating')
      return
    }

    if (formData.content.trim().length < 10) {
      alert('Please write at least 10 characters in your review')
      return
    }

    setSubmitting(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        alert('Please sign in to submit a review')
        return
      }

      // Create review record
      const { data: review, error: reviewError } = await supabase
        .from('product_reviews')
        .insert({
          product_id: productId,
          seller_id: sellerId,
          buyer_id: session.user.id,
          order_id: orderId,
          rating: formData.rating,
          title: formData.title.trim(),
          content: formData.content.trim(),
          would_recommend: formData.wouldRecommend,
          seller_rating: formData.sellerRating || null,
          seller_feedback: formData.sellerFeedback.trim() || null,
          status: 'pending_moderation',
          marketplace_brand: brand,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (reviewError) throw reviewError

      // Upload images if any
      let imageUrls: string[] = []
      if (formData.images.length > 0) {
        imageUrls = await uploadImages(review.id)
        
        // Update review with image URLs
        const { error: updateError } = await supabase
          .from('product_reviews')
          .update({ images: imageUrls })
          .eq('id', review.id)

        if (updateError) throw updateError
      }

      // Update product rating statistics
      await fetch('/api/reviews/update-product-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId })
      })

      if (onSubmit) {
        onSubmit({ ...review, images: imageUrls })
      }

      alert(brand === 'primediscreet' 
        ? 'Elite review submitted successfully! It will appear after moderation.'
        : 'Review submitted successfully! It will appear after moderation.'
      )

    } catch (error: any) {
      console.error('Error submitting review:', error)
      alert('Failed to submit review. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const StarRating = ({ 
    rating, 
    hovered, 
    onRate, 
    onHover, 
    label, 
    size = 'large' 
  }: {
    rating: number
    hovered: number
    onRate: (rating: number) => void
    onHover: (rating: number) => void
    label: string
    size?: 'small' | 'large'
  }) => (
    <div className="flex items-center gap-2">
      <span className={`font-medium ${size === 'small' ? 'text-sm' : ''}`} 
            style={{ color: theme.colors.text.primary }}>
        {label}:
      </span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            onClick={() => onRate(star)}
            onMouseEnter={() => onHover(star)}
            onMouseLeave={() => onHover(0)}
            className={`transition-all ${size === 'small' ? 'text-lg' : 'text-2xl'}`}
            style={{ 
              color: star <= (hovered || rating) ? theme.colors.accent : theme.colors.text.secondary 
            }}
          >
            ★
          </button>
        ))}
      </div>
      <span className={`text-sm ${size === 'small' ? 'text-xs' : ''}`} 
            style={{ color: theme.colors.text.secondary }}>
        {ratingLabels[(hovered || rating) as keyof typeof ratingLabels] || 'Select rating'}
      </span>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
          {brand === 'primediscreet' ? 'Elite Product Review' : 'Write a Review'}
        </h3>
        <p style={{ color: theme.colors.text.secondary }}>
          {brand === 'primediscreet' 
            ? 'Share your elite experience with this premium product'
            : 'Share your experience to help other customers'
          }
        </p>
      </div>

      {/* Product Rating */}
      <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.surface }}>
        <StarRating
          rating={formData.rating}
          hovered={hoveredRating}
          onRate={(rating) => setFormData(prev => ({ ...prev, rating }))}
          onHover={setHoveredRating}
          label="Product Rating"
        />
      </div>

      {/* Review Title */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
          Review Title
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Summarize your experience in a few words"
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.glass.border,
            color: theme.colors.text.primary
          }}
        />
      </div>

      {/* Review Content */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
          Detailed Review *
        </label>
        <textarea
          value={formData.content}
          onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
          placeholder={brand === 'primediscreet' 
            ? 'Share details about the product quality, packaging, and your overall elite experience...'
            : 'Tell us about the product quality, delivery, and your overall experience...'
          }
          rows={5}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.glass.border,
            color: theme.colors.text.primary
          }}
          required
        />
        <div className="text-sm mt-1" style={{ color: theme.colors.text.secondary }}>
          {formData.content.length}/1000 characters (minimum 10)
        </div>
      </div>

      {/* Seller Rating */}
      <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.surface }}>
        <StarRating
          rating={formData.sellerRating}
          hovered={hoveredSellerRating}
          onRate={(rating) => setFormData(prev => ({ ...prev, sellerRating: rating }))}
          onHover={setHoveredSellerRating}
          label="Seller Service"
          size="small"
        />
        
        {formData.sellerRating > 0 && (
          <div className="mt-3">
            <textarea
              value={formData.sellerFeedback}
              onChange={(e) => setFormData(prev => ({ ...prev, sellerFeedback: e.target.value }))}
              placeholder="Optional feedback about the seller's service, communication, and shipping..."
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm"
              style={{
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.glass.border,
                color: theme.colors.text.primary
              }}
            />
          </div>
        )}
      </div>

      {/* Would Recommend */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.wouldRecommend}
            onChange={(e) => setFormData(prev => ({ ...prev, wouldRecommend: e.target.checked }))}
            className="rounded"
          />
          <span style={{ color: theme.colors.text.primary }}>
            {brand === 'primediscreet' 
              ? 'I would recommend this elite product to other premium customers'
              : 'I would recommend this product to others'
            }
          </span>
        </label>
      </div>

      {/* Image Upload */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
          Add Photos (Optional)
        </label>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.glass.border,
            color: theme.colors.text.primary
          }}
        />
        <div className="text-sm mt-1" style={{ color: theme.colors.text.secondary }}>
          Upload up to 5 images to showcase your experience
        </div>
        
        {formData.images.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {formData.images.map((file, index) => (
              <div key={index} className="text-sm p-2 rounded border"
                   style={{ 
                     backgroundColor: theme.colors.background,
                     borderColor: theme.colors.glass.border 
                   }}>
                📷 {file.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit Buttons */}
      <div className="flex gap-4 justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border rounded-lg font-medium transition-all"
            style={{
              borderColor: theme.colors.glass.border,
              color: theme.colors.text.secondary
            }}
          >
            Cancel
          </button>
        )}
        
        <button
          type="submit"
          disabled={submitting || formData.rating === 0}
          className="px-8 py-2 rounded-lg font-semibold transition-all disabled:opacity-50"
          style={{
            backgroundColor: formData.rating > 0 ? theme.colors.accent : theme.colors.background,
            color: formData.rating > 0 
              ? (brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary)
              : theme.colors.text.secondary
          }}
        >
          {submitting ? 'Submitting...' : 
           (brand === 'primediscreet' ? 'Submit Elite Review' : 'Submit Review')}
        </button>
      </div>

      {/* Privacy Notice */}
      <div className="text-xs p-3 rounded" style={{ 
        backgroundColor: theme.colors.background,
        color: theme.colors.text.secondary 
      }}>
        🔒 {brand === 'primediscreet' 
          ? 'Elite reviews are moderated for quality and privacy. Your personal information remains confidential.'
          : 'Reviews are moderated before publication. Your privacy is protected and personal information is not shared.'
        }
      </div>
    </form>
  )
}