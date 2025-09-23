"use client";

import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type DocumentType = 'identity' | 'business_license' | 'tax_document' | 'address_proof' | 'bank_statement'

interface KYCDocument {
  id: string
  document_type: DocumentType
  file_name: string
  verification_status: 'pending' | 'approved' | 'rejected'
  uploaded_at: string
  rejection_reason?: string
}

interface VerificationRequest {
  id: string
  verification_status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'incomplete'
  submission_date: string
  reviewer_notes?: string
  required_documents: string[]
  submitted_documents: string[]
}

const DOCUMENT_TYPES = {
  identity: {
    label: 'Government ID',
    description: 'Valid passport, driver\'s license, or national ID card',
    required: true
  },
  business_license: {
    label: 'Business License',
    description: 'Business registration or operating license',
    required: true
  },
  tax_document: {
    label: 'Tax Document',
    description: 'Tax registration or EIN verification',
    required: false
  },
  address_proof: {
    label: 'Address Verification',
    description: 'Utility bill or bank statement showing address',
    required: false
  },
  bank_statement: {
    label: 'Bank Statement',
    description: 'Recent bank statement for payout verification',
    required: false
  }
}

export default function VerificationPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [documents, setDocuments] = useState<KYCDocument[]>([])
  const [verificationRequest, setVerificationRequest] = useState<VerificationRequest | null>(null)
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!loading && (!user || user.role !== 'seller')) {
      router.push('/dashboard')
      return
    }

    if (user?.id) {
      loadVerificationData()
    }
  }, [user, loading, router])

  const loadVerificationData = async () => {
    try {
      setIsLoading(true)
      
      // Load verification request
      const { data: requestData } = await supabase
        .from('kyc_verification_requests')
        .select('*')
        .eq('seller_id', user!.id)
        .single()

      if (requestData) {
        setVerificationRequest(requestData)
      } else {
        // Create initial verification request
        const { data: newRequest } = await supabase
          .from('kyc_verification_requests')
          .insert({
            seller_id: user!.id,
            required_documents: ['identity', 'business_license']
          })
          .select()
          .single()
        
        if (newRequest) {
          setVerificationRequest(newRequest)
        }
      }

      // Load uploaded documents
      const { data: documentsData } = await supabase
        .from('kyc_documents')
        .select('*')
        .eq('seller_id', user!.id)
        .order('uploaded_at', { ascending: false })

      if (documentsData) {
        setDocuments(documentsData)
      }
    } catch (error) {
      console.error('Error loading verification data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (documentType: DocumentType, file: File) => {
    setUploadingType(documentType)
    
    try {
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB')
        return
      }

      // Convert file to base64 for now (in production, use proper file storage)
      const fileBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })
      
      // Create document record
      const { data } = await supabase
        .from('kyc_documents')
        .insert({
          seller_id: user!.id,
          document_type: documentType,
          file_path: fileBase64, // Store base64 for now
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type
        })
        .select()
        .single()

      if (data) {
        setDocuments(prev => [data, ...prev])
        
        // Update verification request with submitted document
        if (verificationRequest && !verificationRequest.submitted_documents.includes(documentType)) {
          const updatedSubmitted = [...verificationRequest.submitted_documents, documentType]
          const isComplete = verificationRequest.required_documents.every(doc => 
            updatedSubmitted.includes(doc)
          )
          
          await supabase
            .from('kyc_verification_requests')
            .update({
              submitted_documents: updatedSubmitted,
              verification_status: isComplete ? 'under_review' : 'incomplete'
            })
            .eq('id', verificationRequest.id)
          
          await loadVerificationData()
        }
      }
    } catch (error) {
      console.error('Error uploading document:', error)
      alert('Failed to upload document. Please try again.')
    } finally {
      setUploadingType(null)
    }
  }

  if (loading || isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="opacity-80">Loading verification status...</p>
        </div>
      </div>
    )
  }

  if (!user || user.role !== 'seller') {
    return null
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-400 bg-green-600/20'
      case 'rejected': return 'text-red-400 bg-red-600/20'
      case 'under_review': return 'text-blue-400 bg-blue-600/20'
      case 'pending': 
      case 'incomplete':
      default: return 'text-yellow-400 bg-yellow-600/20'
    }
  }

  const getDocumentStatus = (docType: DocumentType) => {
    const doc = documents.find(d => d.document_type === docType)
    if (!doc) return 'not_uploaded'
    return doc.verification_status
  }

  const isDocumentUploaded = (docType: DocumentType) => {
    return documents.some(d => d.document_type === docType)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="glass-card p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-accent-gold mb-2">
              Seller Verification
            </h1>
            <p className="opacity-80">
              Complete your verification to start selling on EntizNet
            </p>
          </div>
          {verificationRequest && (
            <div className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(verificationRequest.verification_status)}`}>
              {verificationRequest.verification_status.replace('_', ' ').toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Verification Status */}
      {verificationRequest && (
        <div className="glass-card p-6">
          <h2 className="font-serif text-xl font-bold text-accent-gold mb-4">Verification Status</h2>
          
          {verificationRequest.verification_status === 'approved' && (
            <div className="p-4 rounded-lg bg-green-600/20 border border-green-600/30 text-green-400">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="font-semibold">Verification Complete!</h3>
                  <p className="text-sm opacity-80">You can now start selling on EntizNet.</p>
                </div>
              </div>
            </div>
          )}

          {verificationRequest.verification_status === 'rejected' && (
            <div className="p-4 rounded-lg bg-red-600/20 border border-red-600/30 text-red-400">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="font-semibold">Verification Rejected</h3>
                  <p className="text-sm opacity-80">Please review the feedback and resubmit documents.</p>
                  {verificationRequest.reviewer_notes && (
                    <p className="text-sm mt-2 p-2 bg-red-600/10 rounded border border-red-600/20">
                      {verificationRequest.reviewer_notes}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {verificationRequest.verification_status === 'under_review' && (
            <div className="p-4 rounded-lg bg-blue-600/20 border border-blue-600/30 text-blue-400">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <div>
                  <h3 className="font-semibold">Under Review</h3>
                  <p className="text-sm opacity-80">Our team is reviewing your documents. This typically takes 2-3 business days.</p>
                </div>
              </div>
            </div>
          )}

          {['pending', 'incomplete'].includes(verificationRequest.verification_status) && (
            <div className="p-4 rounded-lg bg-yellow-600/20 border border-yellow-600/30 text-yellow-400">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <h3 className="font-semibold">Documents Required</h3>
                  <p className="text-sm opacity-80">Please upload all required documents to complete verification.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Document Upload Section */}
      <div className="glass-card p-6">
        <h2 className="font-serif text-xl font-bold text-accent-gold mb-6">Required Documents</h2>
        
        <div className="space-y-6">
          {Object.entries(DOCUMENT_TYPES).map(([type, config]) => {
            const docType = type as DocumentType
            const status = getDocumentStatus(docType)
            const isUploaded = isDocumentUploaded(docType)
            const isUploading = uploadingType === docType
            
            return (
              <div key={type} className="border border-accent-gold/20 rounded-lg p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">{config.label}</h3>
                      {config.required && (
                        <span className="text-xs px-2 py-1 bg-accent-gold/20 text-accent-gold rounded">
                          Required
                        </span>
                      )}
                      {status === 'approved' && (
                        <span className="text-xs px-2 py-1 bg-green-600/20 text-green-400 rounded">
                          Approved
                        </span>
                      )}
                      {status === 'rejected' && (
                        <span className="text-xs px-2 py-1 bg-red-600/20 text-red-400 rounded">
                          Rejected
                        </span>
                      )}
                      {status === 'pending' && isUploaded && (
                        <span className="text-xs px-2 py-1 bg-yellow-600/20 text-yellow-400 rounded">
                          Pending Review
                        </span>
                      )}
                    </div>
                    <p className="text-sm opacity-80 mb-4">{config.description}</p>
                    
                    {isUploaded && (
                      <div className="text-sm">
                        <p className="text-accent-gold">
                          {documents.find(d => d.document_type === docType)?.file_name}
                        </p>
                        <p className="opacity-60 text-xs">
                          Uploaded {new Date(documents.find(d => d.document_type === docType)?.uploaded_at || '').toLocaleDateString()}
                        </p>
                        {status === 'rejected' && (
                          <p className="text-red-400 text-xs mt-2">
                            {documents.find(d => d.document_type === docType)?.rejection_reason}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="ml-6">
                    {isUploading ? (
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-4 h-4 border-2 border-accent-gold border-t-transparent rounded-full animate-spin"></div>
                        Uploading...
                      </div>
                    ) : (
                      <label className="luxury-button-outline px-4 py-2 cursor-pointer">
                        {isUploaded ? 'Replace' : 'Upload'}
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              handleFileUpload(docType, file)
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Help Section */}
      <div className="glass-card p-6">
        <h2 className="font-serif text-xl font-bold text-accent-gold mb-4">Need Help?</h2>
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="font-semibold mb-1">Accepted File Formats</h3>
            <p className="opacity-80">PDF, JPG, JPEG, PNG (Maximum 10MB per file)</p>
          </div>
          <div>
            <h3 className="font-semibold mb-1">Document Requirements</h3>
            <ul className="opacity-80 space-y-1 list-disc list-inside ml-4">
              <li>Documents must be clear and readable</li>
              <li>All corners and edges must be visible</li>
              <li>Information must not be obscured or redacted</li>
              <li>Documents must be current and not expired</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-1">Processing Time</h3>
            <p className="opacity-80">Verification typically takes 2-3 business days once all documents are submitted.</p>
          </div>
        </div>
      </div>
    </div>
  )
}