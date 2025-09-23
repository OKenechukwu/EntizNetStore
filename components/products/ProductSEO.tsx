'use client'

import { useState } from 'react'
import { useBrand } from '@/components/BrandProvider'

interface ProductSEOProps {
  formData: any
  updateFormData: (updates: any) => void
}

export default function ProductSEO({ formData, updateFormData }: ProductSEOProps) {
  const { brand, theme } = useBrand()
  const [tagInput, setTagInput] = useState('')
  const [keywordInput, setKeywordInput] = useState('')

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      updateFormData({
        tags: [...formData.tags, tagInput.trim()]
      })
      setTagInput('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    updateFormData({
      tags: formData.tags.filter((tag: string) => tag !== tagToRemove)
    })
  }

  const addKeyword = () => {
    if (keywordInput.trim() && !formData.search_keywords.includes(keywordInput.trim())) {
      updateFormData({
        search_keywords: [...formData.search_keywords, keywordInput.trim()]
      })
      setKeywordInput('')
    }
  }

  const removeKeyword = (keywordToRemove: string) => {
    updateFormData({
      search_keywords: formData.search_keywords.filter((keyword: string) => keyword !== keywordToRemove)
    })
  }

  const generateSlug = () => {
    if (formData.title) {
      const slug = formData.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .trim()
      updateFormData({ slug })
    }
  }

  const getRecommendedTags = () => {
    if (brand === 'primediscreet') {
      return [
        'ultra-premium',
        'discrete',
        'exclusive',
        'limited-edition',
        'artisan-crafted',
        'luxury-materials',
        'collector-grade',
        'elite-access'
      ]
    }
    return [
      'bestseller',
      'new-arrival',
      'premium-quality',
      'customer-favorite',
      'couples-choice',
      'wellness',
      'beginner-friendly',
      'advanced',
      'waterproof',
      'rechargeable'
    ]
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4" style={{ color: theme.colors.text.primary }}>
          {brand === 'primediscreet' ? 'Elite SEO & Tags' : 'SEO & Tags'}
        </h2>
        <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
          {brand === 'primediscreet' 
            ? 'Optimize your elite product for exclusive search and discovery'
            : 'Optimize your product for search engines and internal search'
          }
        </p>
      </div>

      {/* URL Slug */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
          Product URL Slug
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={formData.slug}
            onChange={(e) => updateFormData({ slug: e.target.value })}
            className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.glass.border,
              color: theme.colors.text.primary
            }}
            placeholder="product-name-slug"
          />
          <button
            onClick={generateSlug}
            className="px-4 py-2 border rounded-lg font-medium transition-all"
            style={{
              borderColor: theme.colors.glass.border,
              color: theme.colors.text.primary
            }}
          >
            Generate
          </button>
        </div>
        <p className="text-xs mt-1" style={{ color: theme.colors.text.secondary }}>
          URL: /store/{formData.slug || 'product-name-slug'}
        </p>
      </div>

      {/* Product Tags */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
          Product Tags
        </label>
        
        {/* Recommended Tags */}
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
            {brand === 'primediscreet' ? 'Elite Tags' : 'Recommended Tags'}
          </h4>
          <div className="flex flex-wrap gap-2">
            {getRecommendedTags().map(tag => (
              <button
                key={tag}
                onClick={() => {
                  if (!formData.tags.includes(tag)) {
                    updateFormData({ tags: [...formData.tags, tag] })
                  }
                }}
                className={`px-3 py-1 rounded-full text-sm transition-all ${
                  formData.tags.includes(tag) 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:opacity-80'
                }`}
                style={{
                  backgroundColor: formData.tags.includes(tag) 
                    ? theme.colors.background 
                    : theme.colors.surface,
                  color: theme.colors.text.secondary,
                  border: `1px solid ${theme.colors.glass.border}`
                }}
                disabled={formData.tags.includes(tag)}
              >
                + {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Add Custom Tag */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTag()}
            className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.glass.border,
              color: theme.colors.text.primary
            }}
            placeholder="Add custom tag..."
          />
          <button
            onClick={addTag}
            className="px-4 py-2 rounded-lg font-medium transition-all"
            style={{
              backgroundColor: theme.colors.accent,
              color: brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary
            }}
          >
            Add Tag
          </button>
        </div>

        {/* Current Tags */}
        {formData.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formData.tags.map((tag: string) => (
              <span 
                key={tag}
                className="px-3 py-1 rounded-full text-sm flex items-center gap-2"
                style={{ 
                  backgroundColor: theme.colors.accent,
                  color: brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary
                }}
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="text-xs hover:opacity-70"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Search Keywords */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
          Search Keywords
        </label>
        <p className="text-sm mb-3" style={{ color: theme.colors.text.secondary }}>
          Keywords that customers might use to find this product
        </p>

        {/* Add Keyword */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
            className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.glass.border,
              color: theme.colors.text.primary
            }}
            placeholder="Add search keyword..."
          />
          <button
            onClick={addKeyword}
            className="px-4 py-2 rounded-lg font-medium transition-all"
            style={{
              backgroundColor: theme.colors.accent,
              color: brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary
            }}
          >
            Add Keyword
          </button>
        </div>

        {/* Current Keywords */}
        {formData.search_keywords.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formData.search_keywords.map((keyword: string) => (
              <span 
                key={keyword}
                className="px-3 py-1 rounded-lg text-sm flex items-center gap-2 border"
                style={{ 
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.glass.border,
                  color: theme.colors.text.primary
                }}
              >
                {keyword}
                <button
                  onClick={() => removeKeyword(keyword)}
                  className="text-xs hover:opacity-70"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* SEO Preview */}
      <div className="p-4 rounded-lg border" style={{ 
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.glass.border 
      }}>
        <h4 className="font-medium mb-3" style={{ color: theme.colors.text.primary }}>
          Search Preview
        </h4>
        <div className="space-y-2">
          <div className="text-blue-600 text-lg font-medium truncate">
            {formData.title || 'Product Title'}
          </div>
          <div className="text-green-700 text-sm">
            {typeof window !== 'undefined' ? window.location.origin : 'https://entiznet.com'}/store/{formData.slug || 'product-slug'}
          </div>
          <div className="text-gray-600 text-sm">
            {formData.short_description || formData.description?.substring(0, 160) || 'Product description will appear here...'}
          </div>
        </div>
      </div>

      {/* SEO Guidelines */}
      <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.background }}>
        <h4 className="font-medium mb-2" style={{ color: theme.colors.text.primary }}>
          SEO Best Practices
        </h4>
        <div className="text-sm space-y-1" style={{ color: theme.colors.text.secondary }}>
          <p>• <strong>Slug:</strong> Use hyphens, lowercase, and descriptive words</p>
          <p>• <strong>Tags:</strong> Use 5-10 relevant tags for product classification</p>
          <p>• <strong>Keywords:</strong> Include terms customers search for</p>
          <p>• <strong>Title:</strong> Keep under 60 characters for search results</p>
          <p>• <strong>Description:</strong> Keep under 160 characters for search snippets</p>
          {brand === 'primediscreet' && (
            <p>• <strong>Elite Focus:</strong> Use premium, exclusive terminology for discoverability</p>
          )}
        </div>
      </div>
    </div>
  )
}