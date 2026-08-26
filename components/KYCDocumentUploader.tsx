"use client";

import { useState } from 'react'

interface KYCDocumentUploaderProps {
  documentType: string
  onUploadComplete: (documentType: string, fileName: string) => void
  disabled?: boolean
}

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

export default function KYCDocumentUploader({
  documentType,
  onUploadComplete,
  disabled = false,
}: KYCDocumentUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const handleFileUpload = async (file: File) => {
    setIsUploading(true)
    setUploadProgress(0)

    try {
      const uploadResponse = await fetch('/api/kyc/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }),
      })
      const initialized = await uploadResponse.json().catch(() => ({}))
      if (!uploadResponse.ok || !initialized.uploadURL || !initialized.uploadId) {
        throw new Error(initialized.error || 'Failed to initialize secure upload')
      }

      setUploadProgress(20)
      const uploadFileResponse = await fetch(initialized.uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      if (!uploadFileResponse.ok) {
        throw new Error('Failed to upload file into private quarantine')
      }

      setUploadProgress(50)
      const finalizeResponse = await fetch('/api/kyc/upload', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: initialized.uploadId }),
      })
      const finalized = await finalizeResponse.json().catch(() => ({}))
      if (!finalizeResponse.ok || !finalized.filePath) {
        throw new Error(finalized.error || 'The document could not be verified safely')
      }

      setUploadProgress(80)
      const saveResponse = await fetch('/api/kyc/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType,
          filePath: finalized.filePath,
          fileName: file.name,
          fileSize: finalized.fileSize,
          mimeType: finalized.mimeType,
        }),
      })
      const saved = await saveResponse.json().catch(() => ({}))
      if (!saveResponse.ok) {
        throw new Error(saved.error || 'Failed to register verified document')
      }

      setUploadProgress(100)
      onUploadComplete(documentType, file.name)
    } catch (error) {
      console.error('KYC upload failed')
      alert(error instanceof Error ? error.message : 'Failed to upload document. Please try again.')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  return (
    <div>
      {isUploading ? (
        <div className="flex flex-col items-center gap-2">
          <div className="w-full bg-charcoal/20 rounded-full h-2">
            <div
              className="bg-accent-gold h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <span className="text-sm">Verifying upload... {uploadProgress}%</span>
        </div>
      ) : (
        <label className={`luxury-button-outline px-4 py-2 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
          Upload Document
          <input
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            disabled={disabled || isUploading}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              if (
                file.size <= 0 ||
                file.size > MAX_FILE_SIZE ||
                !ALLOWED_MIME_TYPES.has(file.type.toLowerCase())
              ) {
                alert('Upload a PDF, JPEG, PNG, or WebP file up to 10MB.')
                event.target.value = ''
                return
              }
              void handleFileUpload(file)
              event.target.value = ''
            }}
          />
        </label>
      )}
    </div>
  )
}
