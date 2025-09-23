'use client'

import { useBrand } from '@/components/BrandProvider'

interface ProductBasicInfoProps {
  formData: any
  updateFormData: (updates: any) => void
  brands: any[]
}

export default function ProductBasicInfo({ formData, updateFormData, brands }: ProductBasicInfoProps) {
  const { brand, theme } = useBrand()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4" style={{ color: theme.colors.text.primary }}>
          {brand === 'primediscreet' ? 'Elite Product Information' : 'Product Information'}
        </h2>
        <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
          {brand === 'primediscreet' 
            ? 'Create an exclusive product for the elite marketplace'
            : 'Enter the basic information for your product'
          }
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
              Product Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => updateFormData({ title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.glass.border,
                color: theme.colors.text.primary
              }}
              placeholder={brand === 'primediscreet' ? 'Elite Product Name' : 'Enter product title'}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
              Product Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => updateFormData({ description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.glass.border,
                color: theme.colors.text.primary
              }}
              placeholder={brand === 'primediscreet' 
                ? 'Detailed description of your exclusive product...'
                : 'Detailed product description...'
              }
            />
          </div>

          {/* Short Description */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
              Short Description
            </label>
            <textarea
              value={formData.short_description}
              onChange={(e) => updateFormData({ short_description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.glass.border,
                color: theme.colors.text.primary
              }}
              placeholder="Brief summary for product cards..."
            />
          </div>

          {/* Material */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
              Material
            </label>
            <input
              type="text"
              value={formData.material}
              onChange={(e) => updateFormData({ material: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.glass.border,
                color: theme.colors.text.primary
              }}
              placeholder="e.g., Medical-grade silicone, Premium leather"
            />
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Marketplace Brand */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
              Marketplace Brand *
            </label>
            <select
              value={formData.marketplace_brand}
              onChange={(e) => updateFormData({ marketplace_brand: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.glass.border,
                color: theme.colors.text.primary
              }}
            >
              <option value="entiznetstore">EntizNet Store (General)</option>
              <option value="primediscreet">Prime Discreet (Elite)</option>
            </select>
          </div>

          {/* Brand */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
              Brand
            </label>
            <select
              value={formData.brand_id}
              onChange={(e) => updateFormData({ brand_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.glass.border,
                color: theme.colors.text.primary
              }}
            >
              <option value="">Select a brand (optional)</option>
              {brands.map(brandItem => (
                <option key={brandItem.id} value={brandItem.id}>
                  {brandItem.name}
                </option>
              ))}
            </select>
          </div>

          {/* Product Type */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
              Product Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => updateFormData({ type: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.glass.border,
                color: theme.colors.text.primary
              }}
            >
              <option value="physical">Physical Product</option>
              <option value="digital">Digital Product</option>
            </select>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                Price *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.base_price}
                onChange={(e) => updateFormData({ base_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.glass.border,
                  color: theme.colors.text.primary
                }}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                Compare At Price
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.compare_at_price || ''}
                onChange={(e) => updateFormData({ compare_at_price: parseFloat(e.target.value) || null })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.glass.border,
                  color: theme.colors.text.primary
                }}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Age Restriction */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
              Age Restriction
            </label>
            <select
              value={formData.age_restriction}
              onChange={(e) => updateFormData({ age_restriction: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.glass.border,
                color: theme.colors.text.primary
              }}
            >
              <option value={18}>18+ (Adult Only)</option>
              <option value={21}>21+ (Restricted)</option>
            </select>
          </div>

          {/* Weight (for shipping) */}
          {formData.type === 'physical' && (
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                Weight (grams)
              </label>
              <input
                type="number"
                value={formData.weight_grams || ''}
                onChange={(e) => updateFormData({ weight_grams: parseInt(e.target.value) || null })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.glass.border,
                  color: theme.colors.text.primary
                }}
                placeholder="Product weight for shipping calculation"
              />
            </div>
          )}
        </div>
      </div>

      {/* Settings Toggles */}
      <div className="space-y-4 pt-6 border-t" style={{ borderColor: theme.colors.glass.border }}>
        <h3 className="font-medium" style={{ color: theme.colors.text.primary }}>
          Product Settings
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={formData.track_inventory}
              onChange={(e) => updateFormData({ track_inventory: e.target.checked })}
              className="rounded"
            />
            <span style={{ color: theme.colors.text.primary }}>Track inventory quantity</span>
          </label>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={formData.requires_shipping}
              onChange={(e) => updateFormData({ requires_shipping: e.target.checked })}
              className="rounded"
            />
            <span style={{ color: theme.colors.text.primary }}>Requires shipping</span>
          </label>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={formData.is_taxable}
              onChange={(e) => updateFormData({ is_taxable: e.target.checked })}
              className="rounded"
            />
            <span style={{ color: theme.colors.text.primary }}>Charge taxes</span>
          </label>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={formData.continue_selling}
              onChange={(e) => updateFormData({ continue_selling: e.target.checked })}
              className="rounded"
            />
            <span style={{ color: theme.colors.text.primary }}>Continue selling when out of stock</span>
          </label>
        </div>
      </div>
    </div>
  )
}