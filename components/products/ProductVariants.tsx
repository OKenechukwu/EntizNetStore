'use client'

import { useState } from 'react'
import { useBrand } from '@/components/BrandProvider'

interface ProductVariantsProps {
  formData: any
  updateFormData: (updates: any) => void
}

export default function ProductVariants({ formData, updateFormData }: ProductVariantsProps) {
  const { brand, theme } = useBrand()
  const [showAddVariant, setShowAddVariant] = useState(false)

  const addVariant = () => {
    const newVariant = {
      title: `Variant ${formData.variants.length + 1}`,
      option1: null,
      option2: null,
      option3: null,
      price: formData.base_price,
      inventory_quantity: 0,
      sku: '',
      weight_grams: formData.weight_grams,
      is_active: true
    }
    
    updateFormData({
      variants: [...formData.variants, newVariant]
    })
    setShowAddVariant(false)
  }

  const updateVariant = (index: number, updates: any) => {
    const updatedVariants = formData.variants.map((variant: any, i: number) => 
      i === index ? { ...variant, ...updates } : variant
    )
    updateFormData({ variants: updatedVariants })
  }

  const removeVariant = (index: number) => {
    if (formData.variants.length > 1) {
      const updatedVariants = formData.variants.filter((_: any, i: number) => i !== index)
      updateFormData({ variants: updatedVariants })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4" style={{ color: theme.colors.text.primary }}>
          {brand === 'primediscreet' ? 'Elite Product Variants' : 'Product Variants'}
        </h2>
        <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
          {brand === 'primediscreet' 
            ? 'Create exclusive variations of your elite product (sizes, colors, materials)'
            : 'Create different variations of your product (sizes, colors, materials, etc.)'
          }
        </p>
      </div>

      {/* Variants List */}
      <div className="space-y-4">
        {formData.variants.map((variant: any, index: number) => (
          <div key={index} className="p-6 border rounded-lg" 
               style={{ 
                 backgroundColor: theme.colors.surface,
                 borderColor: theme.colors.glass.border 
               }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium" style={{ color: theme.colors.text.primary }}>
                Variant {index + 1}
              </h3>
              {formData.variants.length > 1 && (
                <button
                  onClick={() => removeVariant(index)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Variant Title */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Variant Title
                </label>
                <input
                  type="text"
                  value={variant.title}
                  onChange={(e) => updateVariant(index, { title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                  placeholder="e.g., Small Red, Large Blue"
                />
              </div>

              {/* Option 1 (e.g., Size) */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Size / Option 1
                </label>
                <input
                  type="text"
                  value={variant.option1 || ''}
                  onChange={(e) => updateVariant(index, { option1: e.target.value || null })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                  placeholder="e.g., Small, Medium, Large"
                />
              </div>

              {/* Option 2 (e.g., Color) */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Color / Option 2
                </label>
                <input
                  type="text"
                  value={variant.option2 || ''}
                  onChange={(e) => updateVariant(index, { option2: e.target.value || null })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                  placeholder="e.g., Red, Blue, Black"
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Price
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={variant.price}
                  onChange={(e) => updateVariant(index, { price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                  placeholder="0.00"
                />
              </div>

              {/* Inventory */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Inventory Quantity
                </label>
                <input
                  type="number"
                  value={variant.inventory_quantity}
                  onChange={(e) => updateVariant(index, { inventory_quantity: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                  placeholder="0"
                />
              </div>

              {/* SKU */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  SKU (optional)
                </label>
                <input
                  type="text"
                  value={variant.sku}
                  onChange={(e) => updateVariant(index, { sku: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                  placeholder="e.g., PROD-SM-RED"
                />
              </div>
            </div>

            {/* Variant Settings */}
            <div className="mt-4 pt-4 border-t flex items-center justify-between"
                 style={{ borderColor: theme.colors.glass.border }}>
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={variant.is_active}
                  onChange={(e) => updateVariant(index, { is_active: e.target.checked })}
                  className="rounded"
                />
                <span style={{ color: theme.colors.text.primary }}>Active</span>
              </label>
            </div>
          </div>
        ))}
      </div>

      {/* Add Variant Button */}
      <div className="text-center">
        <button
          onClick={addVariant}
          className="px-6 py-3 border-2 border-dashed rounded-lg font-medium transition-all hover:border-solid"
          style={{
            borderColor: theme.colors.glass.border,
            color: theme.colors.text.secondary
          }}
        >
          + Add Variant
        </button>
      </div>

      {/* Variant Options Help */}
      <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.background }}>
        <h4 className="font-medium mb-2" style={{ color: theme.colors.text.primary }}>
          Variant Options Guide
        </h4>
        <div className="text-sm space-y-1" style={{ color: theme.colors.text.secondary }}>
          <p><strong>Option 1:</strong> Usually size (XS, S, M, L, XL)</p>
          <p><strong>Option 2:</strong> Usually color (Red, Blue, Black, etc.)</p>
          <p><strong>Option 3:</strong> Additional attribute (Material, Pattern, etc.)</p>
          <p><strong>SKU:</strong> Unique identifier for inventory tracking</p>
        </div>
      </div>
    </div>
  )
}