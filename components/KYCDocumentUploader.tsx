"use client";

import { useState } from 'react'

interface KYCDocumentUploaderProps {
  documentType: string
  onUploadComplete: (documentType: string, fileName: string) => void
  disabled?: boolean
}

export default function KYCDocumentUploader({ 
  documentType, 
  onUploadComplete, 
  disabled = false 
}: KYCDocumentUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const handleFileUpload = async (file: File) => {
    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Get upload URL from backend
      const uploadResponse = await fetch('/api/kyc/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentType }),
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to get upload URL')
      }

      const { uploadURL } = await uploadResponse.json()

      // Upload file to object storage
      const uploadFileResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      })

      if (!uploadFileResponse.ok) {
        throw new Error('Failed to upload file')
      }

      setUploadProgress(50)

      // Save document record
      const saveResponse = await fetch('/api/kyc/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentType,
          uploadURL,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }),
      })

      if (!saveResponse.ok) {
        throw new Error('Failed to save document record')
      }

      setUploadProgress(100)
      onUploadComplete(documentType, file.name)
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload document. Please try again.')
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
          <span className="text-sm">Uploading... {uploadProgress}%</span>
        </div>
      ) : (
        <label className={`luxury-button-outline px-4 py-2 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
          Upload Document
          <input
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png"
            disabled={disabled || isUploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                // Validate file size (10MB max)
                if (file.size > 10 * 1024 * 1024) {
                  alert('File size must be less than 10MB')
                  return
                }
                handleFileUpload(file)
              }
            }}
          />
        </label>
      )}
    </div>
  )
}