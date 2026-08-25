'use client'

import { useState } from 'react'
import { useBrand } from '@/components/BrandProvider'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import ProductBasicInfo from './ProductBasicInfo'
import ProductVariants from './ProductVariants'
import ProductMedia from './ProductMedia'
import ProductCategories from './ProductCategories'
import ProductSEO from './ProductSEO'

interface ProductFormProps {
  categories: any[]
  brands: any[]
  sellerId: string
  mode: 'create' | 'edit'
  product?: any
}

export default function ProductForm({ 
  categories, 
  brands, 
  sellerId, 
  mode, 
  product 
}: ProductFormProps) {
  const { brand, theme } = useBrand()
  const router = useRouter()
  const supabase = getSupabaseClient()
  
  const [activeTab, setActiveTab] = useState('basic')
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    // Basic Info
    title: product?.title || '',
    description: product?.description || '',
    short_description: product?.short_description || '',
    type: product?.type || 'physical',
    status: product?.status || 'draft',
    marketplace_brand: product?.marketplace_brand || brand,
    brand_id: product?.brand_id || '',
    
    // Pricing
    base_price: product?.base_price || 0,
    compare_at_price: product?.compare_at_price || null,
    cost_per_item: product?.cost_per_item || null,
    
    // Inventory
    track_inventory: product?.track_inventory ?? true,
    continue_selling: product?.continue_selling ?? false,
    
    // Shipping
    requires_shipping: product?.requires_shipping ?? true,
    weight_grams: product?.weight_grams || null,
    
    // Details
    material: product?.material || '',
    age_restriction: product?.age_restriction || 18,
    is_taxable: product?.is_taxable ?? true,
    
    // SEO & Organization
    slug: product?.slug || '',
    tags: product?.tags || [],
    search_keywords: product?.search_keywords || [],
    
    // Categories (many-to-many)
    selectedCategories: [],
    
    // Variants
    variants: product?.product_variants || [
      {
        title: 'Default',
        option1: null,
        option2: null,
        option3: null,
        price: 0,
        inventory_quantity: 0,
        sku: '',
        weight_grams: null,
        is_active: true
      }
    ],
    
    // Media
    media: product?.product_media || []
  })

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: '📝' },
    { id: 'variants', label: 'Variants', icon: '🔧' },
    { id: 'media', label: 'Media', icon: '📸' },
    { id: 'categories', label: 'Categories', icon: '📂' },
    { id: 'seo', label: 'SEO & Tags', icon: '🏷️' }
  ]

  const handleSave = async (publish = false) => {
    setLoading(true)
    
    try {
      // Derive the slug for this save without mutating React state in place.
      const resolvedSlug = formData.slug || formData.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .trim()

      // Set status based on publish parameter. Pending sellers cannot publish
      // 'active' — RLS rejects it (final security boundary).
      const status = publish ? 'active' : 'draft'

      // Seller identity comes from the authenticated Supabase user,
      // never from props/form input.
      const { data: au } = await supabase.auth.getUser()
      if (!au.user) throw new Error('You must be signed in to save a product.')

      const productData = {
        seller_id: au.user.id,
        brand_id: formData.brand_id || null,
        marketplace_brand: formData.marketplace_brand,
        title: formData.title,
        slug: resolvedSlug,
        description: formData.description,
        short_description: formData.short_description,
        type: formData.type,
        status: status,
        base_price: formData.base_price,
        compare_at_price: formData.compare_at_price,
        cost_per_item: formData.cost_per_item,
        track_inventory: formData.track_inventory,
        continue_selling: formData.continue_selling,
        requires_shipping: formData.requires_shipping,
        is_taxable: formData.is_taxable,
        weight_grams: formData.weight_grams,
        material: formData.material,
        age_restriction: formData.age_restriction,
        tags: formData.tags,
        search_keywords: formData.search_keywords
      }

      let productId: string

      if (mode === 'create') {
        const { data: newProduct, error } = await supabase
          .from('products')
          .insert(productData)
          .select()
          .single()

        if (error) throw error
        productId = newProduct.id
      } else {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', product.id)

        if (error) throw error
        productId = product.id
      }

      // Save variants
      if (mode === 'create') {
        for (const variant of formData.variants) {
          const { error } = await supabase
            .from('product_variants')
            .insert({
              product_id: productId,
              title: variant.title,
              option1: variant.option1,
              option2: variant.option2,
              option3: variant.option3,
              price: variant.price,
              inventory_quantity: variant.inventory_quantity,
              sku: variant.sku,
              weight_grams: variant.weight_grams,
              is_active: variant.is_active
            })

          if (error) throw error
        }
      }

      // Save category associations
      if (formData.selectedCategories.length > 0) {
        // First, remove existing associations if editing
        if (mode === 'edit') {
          await supabase
            .from('product_categories')
            .delete()
            .eq('product_id', productId)
        }

        // Add new associations
        const categoryInserts = formData.selectedCategories.map(categoryId => ({
          product_id: productId,
          category_id: categoryId
        }))

        const { error } = await supabase
          .from('product_categories')
          .insert(categoryInserts)

        if (error) throw error
      }

      // Redirect to product or dashboard
      if (publish) {
        router.push(`/store/${resolvedSlug}`)
      } else {
        router.push('/dashboard/store')
      }
      
    } catch (error) {
      console.error('Error saving product:', error)
      alert('Failed to save product. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const updateFormData = (updates: any) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }

  return (
    <div className="space-y-8">
      {/* Tab Navigation */}
      <div className="border-b" style={{ borderColor: theme.colors.glass.border }}>
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-current'
                  : 'border-transparent hover:border-gray-300'
              }`}
              style={{
                color: activeTab === tab.id ? theme.colors.accent : theme.colors.text.secondary
              }}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'basic' && (
          <ProductBasicInfo 
            formData={formData}
            updateFormData={updateFormData}
            brands={brands}
          />
        )}

        {activeTab === 'variants' && (
          <ProductVariants 
            formData={formData}
            updateFormData={updateFormData}
          />
        )}

        {activeTab === 'media' && (
          <ProductMedia 
            formData={formData}
            updateFormData={updateFormData}
          />
        )}

        {activeTab === 'categories' && (
          <ProductCategories 
            formData={formData}
            updateFormData={updateFormData}
            categories={categories}
          />
        )}

        {activeTab === 'seo' && (
          <ProductSEO 
            formData={formData}
            updateFormData={updateFormData}
          />
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-8 border-t"
           style={{ borderColor: theme.colors.glass.border }}>
        <button
          onClick={() => router.back()}
          className="px-6 py-2 border rounded-lg font-medium transition-all"
          style={{
            borderColor: theme.colors.glass.border,
            color: theme.colors.text.secondary
          }}
        >
          Cancel
        </button>

        <div className="flex items-center gap-4">
          <button
            onClick={() => handleSave(false)}
            disabled={loading || !formData.title}
            className="px-6 py-2 border rounded-lg font-medium transition-all disabled:opacity-50"
            style={{
              borderColor: theme.colors.glass.border,
              color: theme.colors.text.primary
            }}
          >
            {loading ? 'Saving...' : 'Save Draft'}
          </button>

          <button
            onClick={() => handleSave(true)}
            disabled={loading || !formData.title}
            className="px-6 py-2 rounded-lg font-medium transition-all disabled:opacity-50"
            style={{
              backgroundColor: theme.colors.accent,
              color: brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary
            }}
          >
            {loading ? 'Publishing...' : 
             (brand === 'primediscreet' ? 'Publish to Elite' : 'Publish Product')}
          </button>
        </div>
      </div>
    </div>
  )
}