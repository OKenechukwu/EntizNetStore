'use client'

import { useState, useRef } from 'react'
import { useBrand } from '@/components/BrandProvider'
import { getSupabaseClient } from '@/lib/supabase/client'

interface DocumentUploadProps {
  sellerId: string
  kycData: any
  onComplete: (data: any) => void
  verificationLevel: 'standard' | 'elite'
}

export default function DocumentUpload({ 
  sellerId, 
  kycData, 
  onComplete, 
  verificationLevel 
}: DocumentUploadProps) {
  const { brand, theme } = useBrand()
  const [documents, setDocuments] = useState<any>({
    governmentId: null,
    proofOfAddress: null,
    businessRegistration: null,
    taxDocument: null,
    professionalReference: null,
    portfolio: null
  })
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({})
  const supabase = getSupabaseClient()
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})

  const documentTypes = [
    {
      key: 'governmentId',
      title: 'Government-Issued Photo ID',
      description: 'Passport, driver\'s license, or national ID card',
      required: true,
      accept: 'image/*,application/pdf'
    },
    {
      key: 'proofOfAddress',
      title: 'Proof of Address',
      description: 'Utility bill, bank statement, or lease agreement (within 3 months)',
      required: true,
      accept: 'image/*,application/pdf'
    },
    {
      key: 'businessRegistration',
      title: 'Business Registration',
      description: 'Business license or incorporation documents (if applicable)',
      required: false,
      accept: 'image/*,application/pdf'
    },
    {
      key: 'taxDocument',
      title: 'Tax Identification',
      description: 'Tax ID number, EIN, or equivalent tax document',
      required: true,
      accept: 'image/*,application/pdf'
    },
    ...(verificationLevel === 'elite' ? [
      {
        key: 'professionalReference',
        title: 'Professional References',
        description: 'Professional references or business portfolio',
        required: true,
        accept: 'image/*,application/pdf'
      },
      {
        key: 'portfolio',
        title: 'Product Portfolio',
        description: 'Examples of products you plan to sell (images/catalog)',
        required: false,
        accept: 'image/*,application/pdf'
      }
    ] : [])
  ]

  const uploadDocument = async (documentType: string, file: File) => {
    if (!file) return null

    setUploading(documentType)
    setUploadProgress(prev => ({ ...prev, [documentType]: 0 }))

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${sellerId}/${documentType}_${Date.now()}.${fileExt}`

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('kyc-documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) throw error

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('kyc-documents')
        .getPublicUrl(fileName)

      return {
        fileName: file.name,
        filePath: fileName,
        fileUrl: urlData.publicUrl,
        fileSize: file.size,
        fileType: file.type,
        uploadedAt: new Date().toISOString()
      }

    } catch (error) {
      console.error('Error uploading document:', error)
      alert('Failed to upload document. Please try again.')
      return null
    } finally {
      setUploading(null)
      setUploadProgress(prev => ({ ...prev, [documentType]: 100 }))
    }
  }

  const handleFileSelect = async (documentType: string, file: File) => {
    if (!file) return

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB')
      return
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      alert('Please upload only JPEG, PNG, or PDF files')
      return
    }

    const uploadedDoc = await uploadDocument(documentType, file)
    
    if (uploadedDoc) {
      setDocuments(prev => ({
        ...prev,
        [documentType]: uploadedDoc
      }))
    }
  }

  const removeDocument = (documentType: string) => {
    setDocuments(prev => ({
      ...prev,
      [documentType]: null
    }))
  }

  const handleSubmit = async () => {
    // Validate required documents
    const requiredDocs = documentTypes.filter(doc => doc.required)
    const missingDocs = requiredDocs.filter(doc => !documents[doc.key])

    if (missingDocs.length > 0) {
      alert(`Please upload all required documents: ${missingDocs.map(doc => doc.title).join(', ')}`)
      return
    }

    // Filter out null documents
    const validDocuments = Object.fromEntries(
      Object.entries(documents).filter(([_, doc]) => doc !== null)
    )

    onComplete(validDocuments)
  }

  const getUploadedCount = () => {
    return Object.values(documents).filter(doc => doc !== null).length
  }

  const getRequiredCount = () => {
    return documentTypes.filter(doc => doc.required).length
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
          {brand === 'primediscreet' ? 'Elite Document Upload' : 'Upload Verification Documents'}
        </h2>
        <p style={{ color: theme.colors.text.secondary }}>
          {brand === 'primediscreet' 
            ? 'Upload high-quality documents for elite verification process'
            : 'Upload clear, high-quality images or PDFs of your documents'
          }
        </p>
        <div className="mt-2">
          <span className="text-sm" style={{ color: theme.colors.accent }}>
            Progress: {getUploadedCount()} / {documentTypes.length} documents uploaded
          </span>
        </div>
      </div>

      {/* Document Upload Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {documentTypes.map(docType => (
          <div key={docType.key} className="border rounded-lg p-6 space-y-4"
               style={{ borderColor: theme.colors.glass.border }}>
            {/* Document Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium flex items-center gap-2" style={{ color: theme.colors.text.primary }}>
                  {docType.title}
                  {docType.required && (
                    <span className="text-red-500 text-sm">*</span>
                  )}
                </h3>
                <p className="text-sm mt-1" style={{ color: theme.colors.text.secondary }}>
                  {docType.description}
                </p>
              </div>
              
              {documents[docType.key] && (
                <div className="text-green-500 text-xl">✓</div>
              )}
            </div>

            {/* Upload Area */}
            {!documents[docType.key] ? (
              <div>
                <button
                  onClick={() => fileInputRefs.current[docType.key]?.click()}
                  disabled={uploading === docType.key}
                  className="w-full p-6 border-2 border-dashed rounded-lg transition-all hover:border-solid"
                  style={{
                    borderColor: theme.colors.glass.border,
                    backgroundColor: theme.colors.background
                  }}
                >
                  {uploading === docType.key ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin w-6 h-6 border-2 border-current border-t-transparent rounded-full"
                           style={{ color: theme.colors.accent }}></div>
                      <span style={{ color: theme.colors.text.secondary }}>
                        Uploading... {uploadProgress[docType.key] || 0}%
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="text-2xl" style={{ color: theme.colors.accent }}>📄</div>
                      <span style={{ color: theme.colors.text.primary }}>
                        Click to upload
                      </span>
                      <span className="text-xs" style={{ color: theme.colors.text.secondary }}>
                        PDF, JPG, PNG (max 10MB)
                      </span>
                    </div>
                  )}
                </button>

                <input
                  ref={el => fileInputRefs.current[docType.key] = el}
                  type="file"
                  accept={docType.accept}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      handleFileSelect(docType.key, file)
                    }
                  }}
                />
              </div>
            ) : (
              /* Uploaded Document Display */
              <div className="p-4 rounded border" style={{ 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.glass.border 
              }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-lg">
                      {documents[docType.key].fileType.includes('pdf') ? '📄' : '🖼️'}
                    </div>
                    <div>
                      <div className="font-medium" style={{ color: theme.colors.text.primary }}>
                        {documents[docType.key].fileName}
                      </div>
                      <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
                        {(documents[docType.key].fileSize / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => removeDocument(docType.key)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    ❌
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Security Notice */}
      <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.background }}>
        <div className="flex items-start gap-3">
          <div className="text-lg">🔒</div>
          <div>
            <h4 className="font-medium" style={{ color: theme.colors.text.primary }}>
              {brand === 'primediscreet' ? 'Elite Security Standards' : 'Document Security'}
            </h4>
            <p className="text-sm mt-1" style={{ color: theme.colors.text.secondary }}>
              {brand === 'primediscreet' 
                ? 'Your documents are protected with military-grade encryption and stored in secure, compliant data centers. Elite verification ensures maximum marketplace trust.'
                : 'Your documents are encrypted and securely stored. We never share your personal information with third parties.'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-center">
        <button
          onClick={handleSubmit}
          disabled={getUploadedCount() < getRequiredCount() || uploading !== null}
          className="px-8 py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
          style={{
            backgroundColor: getUploadedCount() >= getRequiredCount() ? theme.colors.accent : theme.colors.background,
            color: getUploadedCount() >= getRequiredCount() 
              ? (brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary)
              : theme.colors.text.secondary
          }}
        >
          {brand === 'primediscreet' ? 'Submit for Elite Review' : 'Submit Documents'}
        </button>
      </div>
    </div>
  )
}