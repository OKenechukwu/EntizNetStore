'use client'

import { useState, useEffect } from 'react'
import { useBrand } from '@/components/BrandProvider'
import { getSupabaseClient } from '@/lib/supabase/client'

interface Category {
  id: string
  parent_id: string | null
  name: string
  slug: string
  description: string | null
  image_url: string | null
  is_adult: boolean
  sort_order: number
  is_active: boolean
  metadata: any
  created_at: string
  updated_at: string
  subcategories?: Category[]
}

export default function CategoryManager() {
  const { brand, theme } = useBrand()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    parent_id: null as string | null,
    is_active: true,
    sort_order: 0
  })
  const supabase = getSupabaseClient()

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order')
      
      if (error) throw error
      
      // Organize into parent-child structure
      const parentCategories = data?.filter(cat => !cat.parent_id) || []
      const childCategories = data?.filter(cat => cat.parent_id) || []
      
      const organized = parentCategories.map(parent => ({
        ...parent,
        subcategories: childCategories.filter(child => child.parent_id === parent.id)
      }))
      
      setCategories(organized)
    } catch (error) {
      console.error('Error loading categories:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const categoryData = {
        ...formData,
        slug: formData.slug || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        updated_at: new Date().toISOString()
      }

      if (editing) {
        const { error } = await supabase
          .from('categories')
          .update(categoryData)
          .eq('id', editing)
        
        if (error) throw error
        setEditing(null)
      } else {
        const { error } = await supabase
          .from('categories')
          .insert(categoryData)
        
        if (error) throw error
        setCreating(false)
      }

      setFormData({
        name: '',
        slug: '',
        description: '',
        parent_id: null,
        is_active: true,
        sort_order: 0
      })
      
      await loadCategories()
    } catch (error) {
      console.error('Error saving category:', error)
      alert('Failed to save category')
    }
  }

  const handleEdit = (category: Category) => {
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      parent_id: category.parent_id,
      is_active: category.is_active,
      sort_order: category.sort_order
    })
    setEditing(category.id)
    setCreating(false)
  }

  const handleDelete = async (categoryId: string, categoryName: string) => {
    if (!confirm(`Are you sure you want to delete "${categoryName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId)
      
      if (error) throw error
      await loadCategories()
    } catch (error) {
      console.error('Error deleting category:', error)
      alert('Failed to delete category. It may have associated products.')
    }
  }

  const handleCancel = () => {
    setEditing(null)
    setCreating(false)
    setFormData({
      name: '',
      slug: '',
      description: '',
      parent_id: null,
      is_active: true,
      sort_order: 0
    })
  }

  const flatCategories = categories.reduce((flat: Category[], parent) => {
    flat.push(parent)
    if (parent.subcategories) {
      flat.push(...parent.subcategories)
    }
    return flat
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-2 border-current border-t-transparent rounded-full"
             style={{ color: theme.colors.accent }}></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
          {brand === 'primediscreet' ? 'Elite Category Management' : 'Category Management'}
        </h2>
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2 rounded font-medium transition-all"
          style={{
            backgroundColor: theme.colors.accent,
            color: brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary
          }}
        >
          Add Category
        </button>
      </div>

      {/* Form for creating/editing categories */}
      {(creating || editing) && (
        <div className="p-6 border rounded-lg" style={{ 
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.glass.border 
        }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: theme.colors.text.primary }}>
            {editing ? 'Edit Category' : 'Create New Category'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Category Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-2"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                  placeholder="e.g. Premium Vibrators"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  URL Slug
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-2"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                  placeholder="premium-vibrators (auto-generated if empty)"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-2"
                style={{
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.glass.border,
                  color: theme.colors.text.primary
                }}
                placeholder="Brief description of this category"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Parent Category
                </label>
                <select
                  value={formData.parent_id || ''}
                  onChange={(e) => setFormData({ ...formData, parent_id: e.target.value || null })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-2"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                >
                  <option value="">-- Top Level Category --</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Sort Order
                </label>
                <input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-2"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                />
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="mr-2"
                />
                <label htmlFor="is_active" className="text-sm font-medium" style={{ color: theme.colors.text.primary }}>
                  Active
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-4 py-2 rounded font-medium transition-all"
                style={{
                  backgroundColor: theme.colors.accent,
                  color: brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary
                }}
              >
                {editing ? 'Update Category' : 'Create Category'}
              </button>
              
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 rounded border font-medium transition-all"
                style={{
                  borderColor: theme.colors.glass.border,
                  color: theme.colors.text.secondary
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Categories list */}
      <div className="space-y-4">
        {categories.map((category) => (
          <div key={category.id}>
            {/* Parent Category */}
            <div className="p-4 border rounded-lg" style={{ 
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.glass.border 
            }}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold" style={{ color: theme.colors.text.primary }}>
                      {category.name}
                    </h3>
                    <span className="text-xs px-2 py-1 rounded" style={{ 
                      backgroundColor: category.is_active ? 'rgb(34 197 94 / 0.1)' : 'rgb(239 68 68 / 0.1)',
                      color: category.is_active ? 'rgb(34 197 94)' : 'rgb(239 68 68)'
                    }}>
                      {category.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm mt-1" style={{ color: theme.colors.text.secondary }}>
                    /{category.slug}
                    {category.description && ` • ${category.description}`}
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(category)}
                    className="text-sm px-3 py-1 rounded border transition-all"
                    style={{
                      borderColor: theme.colors.glass.border,
                      color: theme.colors.text.primary
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(category.id, category.name)}
                    className="text-sm px-3 py-1 rounded text-red-500 border border-red-200 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>

            {/* Subcategories */}
            {category.subcategories && category.subcategories.length > 0 && (
              <div className="ml-6 mt-2 space-y-2">
                {category.subcategories.map((subcat) => (
                  <div key={subcat.id} className="p-3 border rounded" style={{ 
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.glass.border 
                  }}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-400">↳</span>
                          <h4 className="font-medium" style={{ color: theme.colors.text.primary }}>
                            {subcat.name}
                          </h4>
                          <span className="text-xs px-2 py-1 rounded" style={{ 
                            backgroundColor: subcat.is_active ? 'rgb(34 197 94 / 0.1)' : 'rgb(239 68 68 / 0.1)',
                            color: subcat.is_active ? 'rgb(34 197 94)' : 'rgb(239 68 68)'
                          }}>
                            {subcat.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-xs mt-1" style={{ color: theme.colors.text.secondary }}>
                          /{subcat.slug}
                          {subcat.description && ` • ${subcat.description}`}
                        </p>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(subcat)}
                          className="text-xs px-2 py-1 rounded border transition-all"
                          style={{
                            borderColor: theme.colors.glass.border,
                            color: theme.colors.text.primary
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(subcat.id, subcat.name)}
                          className="text-xs px-2 py-1 rounded text-red-500 border border-red-200 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4" style={{ color: theme.colors.accent }}>🗂️</div>
          <h3 className="text-xl font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
            No Categories Yet
          </h3>
          <p style={{ color: theme.colors.text.secondary }}>
            Create your first category to organize products
          </p>
        </div>
      )}
    </div>
  )
}