'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
// Removed unused supabase import - now using secure API endpoints

interface KYCDocument {
  id: string
  seller_id: string
  document_type: string
  file_name: string
  file_size: number
  mime_type: string
  verification_status: string
  rejection_reason?: string
  uploaded_at: string
  reviewed_at?: string
  reviewed_by?: string
}

interface VerificationRequest {
  id: string
  seller_id: string
  verification_status: string
  submission_date: string
  review_date?: string
  reviewer_notes?: string
  required_documents: string[]
  submitted_documents: string[]
}

interface SellerProfile {
  id: string
  storefront_name: string
  business_type: string
  verification_status: string
}

interface PendingReview {
  request: VerificationRequest
  documents: KYCDocument[]
  seller: SellerProfile
}

export default function AdminKYCDashboard() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([])
  const [selectedReview, setSelectedReview] = useState<PendingReview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [reviewingDocument, setReviewingDocument] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      router.push('/dashboard')
      return
    }

    if (user?.id) {
      loadPendingReviews().catch(console.error)
    }
  }, [user, loading, router])

  const loadPendingReviews = async (): Promise<PendingReview[]> => {
    try {
      setIsLoading(true)

      // Load pending reviews through secure API endpoint
      const response = await fetch('/api/admin/kyc/pending')
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to load pending reviews')
      }

      const { pendingReviews: reviews } = await response.json()
      const reviewsList = reviews || []
      setPendingReviews(reviewsList)
      return reviewsList
      
    } catch (error) {
      console.error('Error loading pending reviews:', error)
      alert(`Failed to load pending reviews: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return []
    } finally {
      setIsLoading(false)
    }
  }

  const handleReviewDocument = async (documentId: string, status: 'approved' | 'rejected', reason?: string) => {
    try {
      setReviewingDocument(documentId)

      const response = await fetch('/api/admin/kyc/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'review_document',
          documentId,
          status,
          reason
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to review document')
      }

      // Reload data and update selected review with fresh data
      const freshReviews = await loadPendingReviews()
      
      // Update selected review if it's currently displayed
      if (selectedReview) {
        const updatedReview = freshReviews.find(r => 
          r.request.id === selectedReview.request.id
        )
        if (updatedReview) {
          setSelectedReview(updatedReview)
        } else {
          // Review may have been moved out of pending status
          setSelectedReview(null)
        }
      }

    } catch (error) {
      console.error('Error reviewing document:', error)
      alert(`Failed to update document status: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setReviewingDocument(null)
    }
  }

  const handleCompleteVerification = async (requestId: string, status: 'approved' | 'rejected', notes?: string) => {
    try {
      const response = await fetch('/api/admin/kyc/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_verification',
          requestId,
          status,
          notes
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to complete verification')
      }

      // Reload and close (verification completed, remove from pending list)
      await loadPendingReviews()
      setSelectedReview(null)

    } catch (error) {
      console.error('Error completing verification:', error)
      alert(`Failed to complete verification: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleViewDocument = async (documentId: string) => {
    try {
      // Fetch document through secure API endpoint
      const response = await fetch(`/api/admin/kyc/document/${documentId}`)
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch document')
      }

      const { document, viewUrl, message } = await response.json()
      
      if (viewUrl) {
        // Open document in new tab for viewing
        const newWindow = window.open(viewUrl, '_blank')
        if (!newWindow) {
          alert('Please allow pop-ups to view documents')
        }
      } else {
        // Show document metadata if viewing URL is not available
        const info = [
          `Document: ${document.file_name}`,
          `Type: ${document.document_type}`,
          `Size: ${formatFileSize(document.file_size)}`,
          `Status: ${document.verification_status}`,
          `Uploaded: ${new Date(document.uploaded_at).toLocaleDateString()}`
        ].join('\\n')
        
        alert(`Document Details:\\n\\n${info}${message ? '\\n\\n' + message : ''}`)
      }
      
    } catch (error) {
      console.error('Error viewing document:', error)
      alert(`Failed to view document: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const getDocumentTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      identity: 'Government ID',
      business_license: 'Business License',
      tax_document: 'Tax Document',
      address_proof: 'Address Proof',
      bank_statement: 'Bank Statement'
    }
    return labels[type] || type
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-amber-400'
      case 'under_review': return 'text-blue-400'
      case 'approved': return 'text-green-400'
      case 'rejected': return 'text-red-400'
      default: return 'text-charcoal/60'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-gold mx-auto mb-4"></div>
          <p className="text-charcoal/60">Loading KYC reviews...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="bg-charcoal border-b border-charcoal/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div>
              <h1 className="text-3xl font-bold text-gold">Admin KYC Dashboard</h1>
              <p className="text-charcoal/60 mt-1">Review and manage seller verification requests</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-charcoal/60">Pending Reviews</p>
              <p className="text-2xl font-bold text-accent-gold">{pendingReviews.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Reviews List */}
          <div className="w-1/2">
            <h2 className="text-xl font-semibold text-charcoal mb-4">Pending Verification Requests</h2>
            
            {pendingReviews.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center">
                <p className="text-charcoal/60">No pending reviews at this time</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingReviews.map((review) => (
                  <div
                    key={review.request.id}
                    className={`bg-white rounded-lg p-6 cursor-pointer transition-all duration-200 hover:shadow-lg border-2 ${
                      selectedReview?.request.id === review.request.id
                        ? 'border-accent-gold'
                        : 'border-transparent'
                    }`}
                    onClick={() => setSelectedReview(review)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-charcoal">{review.seller.storefront_name}</h3>
                        <p className="text-sm text-charcoal/60">{review.seller.business_type}</p>
                        <p className="text-sm text-charcoal/60">
                          Submitted: {new Date(review.request.submission_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-medium ${getStatusColor(review.request.verification_status)}`}>
                          {review.request.verification_status}
                        </span>
                        <p className="text-sm text-charcoal/60 mt-1">
                          {review.documents.length} documents
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Review Details */}
          <div className="w-1/2">
            {selectedReview ? (
              <div className="bg-white rounded-lg p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-charcoal">{selectedReview.seller.storefront_name}</h2>
                    <p className="text-charcoal/60">{selectedReview.seller.business_type}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedReview.request.verification_status)}`}>
                    {selectedReview.request.verification_status}
                  </span>
                </div>

                {/* Documents */}
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-charcoal mb-4">Submitted Documents</h3>
                  
                  {selectedReview.documents.length === 0 ? (
                    <p className="text-charcoal/60">No documents uploaded yet</p>
                  ) : (
                    <div className="space-y-4">
                      {selectedReview.documents.map((doc) => (
                        <div key={doc.id} className="border border-charcoal/10 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium text-charcoal">{getDocumentTypeLabel(doc.document_type)}</h4>
                              <p className="text-sm text-charcoal/60">{doc.file_name}</p>
                              <p className="text-sm text-charcoal/60">{formatFileSize(doc.file_size)}</p>
                              <p className="text-sm text-charcoal/60">
                                Uploaded: {new Date(doc.uploaded_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className={`text-sm font-medium ${getStatusColor(doc.verification_status || 'pending')}`}>
                                {doc.verification_status || 'pending'}
                              </span>
                            </div>
                          </div>

                          {doc.rejection_reason && (
                            <div className="mt-3 p-3 bg-red-50 rounded-lg">
                              <p className="text-sm text-red-600">
                                <strong>Rejection Reason:</strong> {doc.rejection_reason}
                              </p>
                            </div>
                          )}

                          <div className="mt-4 flex gap-2">
                            <button
                              onClick={() => handleViewDocument(doc.id)}
                              className="px-3 py-1 bg-accent-gold text-charcoal rounded text-sm hover:bg-accent-gold/80 transition-colors"
                            >
                              View Document
                            </button>
                            
                            {doc.verification_status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleReviewDocument(doc.id, 'approved')}
                                  disabled={reviewingDocument === doc.id}
                                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => {
                                    const reason = prompt('Rejection reason:')
                                    if (reason) {
                                      handleReviewDocument(doc.id, 'rejected', reason)
                                    }
                                  }}
                                  disabled={reviewingDocument === doc.id}
                                  className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Complete Verification */}
                {selectedReview.documents.length > 0 && (
                  <div className="border-t border-charcoal/10 pt-6">
                    <h3 className="text-lg font-medium text-charcoal mb-4">Complete Verification</h3>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          const notes = prompt('Admin notes (optional):')
                          handleCompleteVerification(selectedReview.request.id, 'approved', notes || undefined)
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        Approve Verification
                      </button>
                      <button
                        onClick={() => {
                          const notes = prompt('Rejection notes:')
                          if (notes) {
                            handleCompleteVerification(selectedReview.request.id, 'rejected', notes)
                          }
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                      >
                        Reject Verification
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg p-8 text-center">
                <p className="text-charcoal/60">Select a verification request to review</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}