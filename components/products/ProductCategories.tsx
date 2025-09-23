'use client'

import { useBrand } from '@/components/BrandProvider'

interface ProductCategoriesProps {
  formData: any
  updateFormData: (updates: any) => void
  categories: any[]
}

export default function ProductCategories({ formData, updateFormData, categories }: ProductCategoriesProps) {
  const { brand, theme } = useBrand()

  // Filter categories based on marketplace brand
  const brandCategories = categories.filter(category => {
    // You could add brand-specific filtering logic here
    // For now, show all categories but highlight brand-appropriate ones
    return true
  })

  const mainCategories = brandCategories.filter(cat => !cat.parent_id)
  const getSubcategories = (parentId: string) => 
    brandCategories.filter(cat => cat.parent_id === parentId)

  const toggleCategory = (categoryId: string) => {
    const currentCategories = formData.selectedCategories || []
    const isSelected = currentCategories.includes(categoryId)
    
    if (isSelected) {
      updateFormData({
        selectedCategories: currentCategories.filter((id: string) => id !== categoryId)
      })
    } else {
      updateFormData({
        selectedCategories: [...currentCategories, categoryId]
      })
    }
  }

  const getRecommendedCategories = () => {
    if (brand === 'primediscreet') {
      return [
        'Premium Intimate',
        'Luxury Collections', 
        'Discrete Accessories',
        'Elite Experiences',
        'Exclusive Editions'
      ]
    }
    return [
      'Vibrators',
      'Dildos & Toys',
      'Men\'s Toys',
      'Couples\' Toys',
      'Wellness Products'
    ]
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4" style={{ color: theme.colors.text.primary }}>
          {brand === 'primediscreet' ? 'Elite Product Categories' : 'Product Categories'}
        </h2>
        <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
          {brand === 'primediscreet' 
            ? 'Select exclusive categories that best describe your elite product'
            : 'Select categories that best describe your product. You can choose multiple categories.'
          }
        </p>
      </div>

      {/* Recommended Categories */}
      <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.background }}>
        <h3 className="font-medium mb-3" style={{ color: theme.colors.text.primary }}>
          {brand === 'primediscreet' ? 'Elite Categories' : 'Recommended Categories'}
        </h3>
        <div className="flex flex-wrap gap-2">
          {getRecommendedCategories().map(categoryName => {
            const category = categories.find(cat => cat.name === categoryName)
            if (!category) return null
            
            const isSelected = formData.selectedCategories?.includes(category.id)
            
            return (
              <button
                key={category.id}
                onClick={() => toggleCategory(category.id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                  isSelected 
                    ? 'border-current' 
                    : 'border-transparent hover:border-current'
                }`}
                style={{
                  backgroundColor: isSelected ? theme.colors.accent : theme.colors.surface,
                  color: isSelected 
                    ? (brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary)
                    : theme.colors.text.primary,
                  borderColor: isSelected ? theme.colors.accent : theme.colors.glass.border
                }}
              >
                {categoryName}
              </button>
            )
          })}
        </div>
      </div>

      {/* All Categories */}
      <div className="space-y-4">
        <h3 className="font-medium" style={{ color: theme.colors.text.primary }}>
          All Categories
        </h3>
        
        <div className="space-y-4">
          {mainCategories.map(mainCategory => {
            const subcategories = getSubcategories(mainCategory.id)
            const isMainSelected = formData.selectedCategories?.includes(mainCategory.id)
            
            return (
              <div key={mainCategory.id} className="border rounded-lg p-4"
                   style={{ borderColor: theme.colors.glass.border }}>
                {/* Main Category */}
                <div className="flex items-center space-x-3 mb-3">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isMainSelected}
                      onChange={() => toggleCategory(mainCategory.id)}
                      className="rounded"
                      style={{ accentColor: theme.colors.accent }}
                    />
                    <span className="font-medium" style={{ color: theme.colors.text.primary }}>
                      {mainCategory.name}
                    </span>
                  </label>
                  {mainCategory.description && (
                    <span className="text-sm" style={{ color: theme.colors.text.secondary }}>
                      — {mainCategory.description}
                    </span>
                  )}
                </div>

                {/* Subcategories */}
                {subcategories.length > 0 && (
                  <div className="ml-6 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {subcategories.map(subcategory => {
                        const isSubSelected = formData.selectedCategories?.includes(subcategory.id)
                        
                        return (
                          <label key={subcategory.id} className="flex items-center space-x-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isSubSelected}
                              onChange={() => toggleCategory(subcategory.id)}
                              className="rounded"
                              style={{ accentColor: theme.colors.accent }}
                            />
                            <span className="text-sm" style={{ color: theme.colors.text.primary }}>
                              {subcategory.name}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected Categories Summary */}
      {formData.selectedCategories && formData.selectedCategories.length > 0 && (
        <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.surface }}>
          <h4 className="font-medium mb-2" style={{ color: theme.colors.text.primary }}>
            Selected Categories ({formData.selectedCategories.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {formData.selectedCategories.map((categoryId: string) => {
              const category = categories.find(cat => cat.id === categoryId)
              if (!category) return null
              
              return (
                <span 
                  key={categoryId}
                  className="px-3 py-1 rounded-full text-sm"
                  style={{ 
                    backgroundColor: theme.colors.accent,
                    color: brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary
                  }}
                >
                  {category.name}
                  <button
                    onClick={() => toggleCategory(categoryId)}
                    className="ml-2 text-xs hover:opacity-70"
                  >
                    ×
                  </button>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Category Guidelines */}
      <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.background }}>
        <h4 className="font-medium mb-2" style={{ color: theme.colors.text.primary }}>
          Category Guidelines
        </h4>
        <div className="text-sm space-y-1" style={{ color: theme.colors.text.secondary }}>
          <p>• Choose the most specific categories that accurately describe your product</p>
          <p>• Select 2-4 categories for optimal discoverability</p>
          <p>• Both main categories and subcategories can be selected</p>
          {brand === 'primediscreet' && (
            <>
              <p>• Elite categories are curated for premium, discrete products</p>
              <p>• Ensure your product meets the quality standards for selected categories</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}