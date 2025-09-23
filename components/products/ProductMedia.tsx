'use client'

import { useState, useRef } from 'react'
import { useBrand } from '@/components/BrandProvider'

interface ProductMediaProps {
  formData: any
  updateFormData: (updates: any) => void
}

export default function ProductMedia({ formData, updateFormData }: ProductMediaProps) {
  const { brand, theme } = useBrand()
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (files: FileList) => {
    setUploading(true)
    
    try {
      // For now, we'll create placeholder URLs
      // In a real implementation, this would upload to Supabase Storage
      const newMedia = Array.from(files).map((file, index) => ({
        id: `temp-${Date.now()}-${index}`,
        type: file.type.startsWith('video/') ? 'video' : 'image',
        url: URL.createObjectURL(file),
        alt_text: file.name,
        caption: '',
        position: formData.media.length + index,
        file: file // Store file for actual upload later
      }))

      updateFormData({
        media: [...formData.media, ...newMedia]
      })
    } catch (error) {
      console.error('Error uploading files:', error)
    } finally {
      setUploading(false)
    }
  }

  const updateMedia = (index: number, updates: any) => {
    const updatedMedia = formData.media.map((item: any, i: number) => 
      i === index ? { ...item, ...updates } : item
    )
    updateFormData({ media: updatedMedia })
  }

  const removeMedia = (index: number) => {
    const updatedMedia = formData.media.filter((_: any, i: number) => i !== index)
    updateFormData({ media: updatedMedia })
  }

  const reorderMedia = (fromIndex: number, toIndex: number) => {
    const updatedMedia = [...formData.media]
    const [moved] = updatedMedia.splice(fromIndex, 1)
    updatedMedia.splice(toIndex, 0, moved)
    
    // Update positions
    updatedMedia.forEach((item, index) => {
      item.position = index
    })
    
    updateFormData({ media: updatedMedia })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4" style={{ color: theme.colors.text.primary }}>
          {brand === 'primediscreet' ? 'Elite Product Media' : 'Product Media'}
        </h2>
        <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
          {brand === 'primediscreet' 
            ? 'Upload high-quality, exclusive product images and videos'
            : 'Upload product images and videos. First image will be the main product image.'
          }
        </p>
      </div>

      {/* Upload Area */}
      <div 
        className="border-2 border-dashed rounded-lg p-8 text-center transition-all hover:border-solid cursor-pointer"
        style={{ borderColor: theme.colors.glass.border }}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="space-y-4">
          <div className="text-4xl" style={{ color: theme.colors.accent }}>
            📸
          </div>
          <div>
            <h3 className="font-medium" style={{ color: theme.colors.text.primary }}>
              {uploading ? 'Uploading...' : 'Upload Product Media'}
            </h3>
            <p className="text-sm mt-1" style={{ color: theme.colors.text.secondary }}>
              Drag and drop files here, or click to browse
            </p>
            <p className="text-xs mt-2" style={{ color: theme.colors.text.secondary }}>
              Supports: JPEG, PNG, GIF, MP4, WebM (Max 10MB each)
            </p>
          </div>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(e.target.files)
          }
        }}
      />

      {/* Media Grid */}
      {formData.media.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-medium" style={{ color: theme.colors.text.primary }}>
            Uploaded Media ({formData.media.length})
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {formData.media.map((item: any, index: number) => (
              <div key={item.id} className="border rounded-lg overflow-hidden"
                   style={{ borderColor: theme.colors.glass.border }}>
                {/* Media Preview */}
                <div className="aspect-square bg-gray-100 relative">
                  {item.type === 'image' ? (
                    <img 
                      src={item.url} 
                      alt={item.alt_text}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <video 
                      src={item.url}
                      className="w-full h-full object-cover"
                      controls
                    />
                  )}
                  
                  {/* Position Badge */}
                  <div className="absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium text-white"
                       style={{ backgroundColor: theme.colors.accent }}>
                    {index === 0 ? 'Main' : `#${index + 1}`}
                  </div>
                  
                  {/* Remove Button */}
                  <button
                    onClick={() => removeMedia(index)}
                    className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 transition-colors"
                  >
                    ×
                  </button>
                </div>

                {/* Media Details */}
                <div className="p-3 space-y-2">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: theme.colors.text.primary }}>
                      Alt Text
                    </label>
                    <input
                      type="text"
                      value={item.alt_text}
                      onChange={(e) => updateMedia(index, { alt_text: e.target.value })}
                      className="w-full px-2 py-1 text-xs border rounded"
                      style={{
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.glass.border,
                        color: theme.colors.text.primary
                      }}
                      placeholder="Describe the image..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: theme.colors.text.primary }}>
                      Caption (optional)
                    </label>
                    <input
                      type="text"
                      value={item.caption}
                      onChange={(e) => updateMedia(index, { caption: e.target.value })}
                      className="w-full px-2 py-1 text-xs border rounded"
                      style={{
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.glass.border,
                        color: theme.colors.text.primary
                      }}
                      placeholder="Optional caption..."
                    />
                  </div>

                  {/* Reorder Buttons */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex gap-1">
                      {index > 0 && (
                        <button
                          onClick={() => reorderMedia(index, index - 1)}
                          className="px-2 py-1 text-xs border rounded"
                          style={{
                            borderColor: theme.colors.glass.border,
                            color: theme.colors.text.secondary
                          }}
                        >
                          ← Move Left
                        </button>
                      )}
                      {index < formData.media.length - 1 && (
                        <button
                          onClick={() => reorderMedia(index, index + 1)}
                          className="px-2 py-1 text-xs border rounded"
                          style={{
                            borderColor: theme.colors.glass.border,
                            color: theme.colors.text.secondary
                          }}
                        >
                          Move Right →
                        </button>
                      )}
                    </div>
                    
                    <span className="text-xs" style={{ color: theme.colors.text.secondary }}>
                      {item.type === 'image' ? '📷' : '🎬'} {item.type}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Media Guidelines */}
      <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.background }}>
        <h4 className="font-medium mb-2" style={{ color: theme.colors.text.primary }}>
          {brand === 'primediscreet' ? 'Elite Media Guidelines' : 'Media Guidelines'}
        </h4>
        <div className="text-sm space-y-1" style={{ color: theme.colors.text.secondary }}>
          <p>• <strong>Main Image:</strong> The first image will be used as the primary product image</p>
          <p>• <strong>Quality:</strong> Use high-resolution images (minimum 800x800px)</p>
          <p>• <strong>Lighting:</strong> Well-lit, clear photos work best</p>
          <p>• <strong>Backgrounds:</strong> Clean, neutral backgrounds are recommended</p>
          <p>• <strong>Multiple Angles:</strong> Show different views and details</p>
          {brand === 'primediscreet' && (
            <p>• <strong>Elite Standards:</strong> Maintain premium quality and tasteful presentation</p>
          )}
        </div>
      </div>
    </div>
  )
}