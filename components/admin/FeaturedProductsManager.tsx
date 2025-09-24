'use client'

import { useState, useEffect } from 'react'
import { useBrand } from '@/components/BrandProvider'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface FeaturedProduct {
  id: string
  product_id: string
  marketplace_brand: string
  feature_type: 'hero' | 'spotlight' | 'sale' | 'new_arrival' | 'trending'
  title: string | null
  description: string | null
  image_url: string | null
  link_url: string | null
  sort_order: number
  is_active: boolean
  starts_at: string
  ends_at: string | null
  product?: {
    title: string
    base_price: number
    images?: string[]
  }
}

interface Product {
  id: string
  title: string
  base_price: number
  marketplace_brand: string
  status: string
}

export default function FeaturedProductsManager() {
  const { brand, theme } = useBrand()
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [formData, setFormData] = useState({
    product_id: '',
    feature_type: 'spotlight' as const,
    title: '',
    description: '',
    image_url: '',
    link_url: '',
    sort_order: 0,
    is_active: true,
    starts_at: new Date().toISOString().slice(0, 16),
    ends_at: ''
  })
  const supabase = createClientComponentClient()

  const featureTypes = [
    { value: 'hero', label: 'Hero Banner', description: 'Main homepage banner' },
    { value: 'spotlight', label: 'Product Spotlight', description: 'Featured on category pages' },
    { value: 'sale', label: 'Sale Item', description: 'Special promotion or discount' },
    { value: 'new_arrival', label: 'New Arrival', description: 'Recently added products' },
    { value: 'trending', label: 'Trending', description: 'Popular or trending items' }
  ]

  useEffect(() => {
    loadData()
  }, [brand])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load featured products
      const { data: featuredData, error: featuredError } = await supabase
        .from('featured_products')
        .select(`
          *,
          product:products(title, base_price)
        `)
        .eq('marketplace_brand', brand)
        .order('sort_order')
      
      if (featuredError) throw featuredError
      
      // Load available products for selection
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, title, base_price, marketplace_brand, status')
        .eq('marketplace_brand', brand)
        .eq('status', 'active')
        .order('title')
      
      if (productsError) throw productsError
      
      setFeaturedProducts(featuredData || [])
      setProducts(productsData || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.product_id) {
      alert('Please select a product')
      return
    }
    
    try {
      const featuredData = {
        ...formData,
        marketplace_brand: brand,
        starts_at: new Date(formData.starts_at).toISOString(),
        ends_at: formData.ends_at ? new Date(formData.ends_at).toISOString() : null,
        updated_at: new Date().toISOString()
      }

      if (editing) {
        const { error } = await supabase
          .from('featured_products')
          .update(featuredData)
          .eq('id', editing)
        
        if (error) throw error
        setEditing(null)
      } else {
        const { error } = await supabase
          .from('featured_products')
          .insert(featuredData)
        
        if (error) throw error
        setCreating(false)
      }

      setFormData({
        product_id: '',
        feature_type: 'spotlight',
        title: '',
        description: '',
        image_url: '',
        link_url: '',
        sort_order: 0,
        is_active: true,
        starts_at: new Date().toISOString().slice(0, 16),
        ends_at: ''
      })
      
      await loadData()
    } catch (error) {
      console.error('Error saving featured product:', error)
      alert('Failed to save featured product')
    }
  }

  const handleEdit = (featured: FeaturedProduct) => {
    setFormData({
      product_id: featured.product_id,
      feature_type: featured.feature_type,
      title: featured.title || '',
      description: featured.description || '',
      image_url: featured.image_url || '',
      link_url: featured.link_url || '',
      sort_order: featured.sort_order,
      is_active: featured.is_active,
      starts_at: new Date(featured.starts_at).toISOString().slice(0, 16),
      ends_at: featured.ends_at ? new Date(featured.ends_at).toISOString().slice(0, 16) : ''
    })
    setEditing(featured.id)
    setCreating(false)
  }

  const handleDelete = async (featuredId: string, title: string) => {
    if (!confirm(`Remove "${title}" from featured products?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('featured_products')
        .delete()
        .eq('id', featuredId)
      
      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error deleting featured product:', error)
      alert('Failed to remove featured product')
    }
  }

  const handleCancel = () => {
    setEditing(null)
    setCreating(false)
    setFormData({
      product_id: '',
      feature_type: 'spotlight',
      title: '',
      description: '',
      image_url: '',
      link_url: '',
      sort_order: 0,
      is_active: true,
      starts_at: new Date().toISOString().slice(0, 16),
      ends_at: ''
    })
  }

  const getFeatureTypeColor = (type: string) => {
    switch (type) {
      case 'hero': return 'bg-purple-100 text-purple-800'
      case 'spotlight': return 'bg-blue-100 text-blue-800'
      case 'sale': return 'bg-red-100 text-red-800'
      case 'new_arrival': return 'bg-green-100 text-green-800'
      case 'trending': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const isExpired = (endsAt: string | null) => {
    if (!endsAt) return false
    return new Date(endsAt) < new Date()
  }

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
          {brand === 'primediscreet' ? 'Elite Featured Products' : 'Featured Products'}
        </h2>
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2 rounded font-medium transition-all"
          style={{
            backgroundColor: theme.colors.accent,
            color: brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary
          }}
        >
          Add Featured Product
        </button>
      </div>

      {/* Form for creating/editing featured products */}
      {(creating || editing) && (
        <div className="p-6 border rounded-lg" style={{ 
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.glass.border 
        }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: theme.colors.text.primary }}>
            {editing ? 'Edit Featured Product' : 'Add Featured Product'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Select Product *
                </label>
                <select
                  value={formData.product_id}
                  onChange={(e) => {
                    const selectedProduct = products.find(p => p.id === e.target.value)
                    setFormData({ 
                      ...formData, 
                      product_id: e.target.value,
                      title: formData.title || selectedProduct?.title || ''
                    })
                  }}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-2"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                >
                  <option value="">-- Select Product --</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.title} (${product.base_price})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Feature Type *
                </label>
                <select
                  value={formData.feature_type}
                  onChange={(e) => setFormData({ ...formData, feature_type: e.target.value as any })}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-2"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                >
                  {featureTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs mt-1" style={{ color: theme.colors.text.secondary }}>
                  {featureTypes.find(t => t.value === formData.feature_type)?.description}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                Custom Title (optional)
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-2"
                style={{
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.glass.border,
                  color: theme.colors.text.primary
                }}
                placeholder="Override product title for feature display"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                Description (optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-2"
                style={{
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.glass.border,
                  color: theme.colors.text.primary
                }}
                placeholder="Custom description for the featured item"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Start Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={formData.starts_at}
                  onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-2"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  End Date & Time (optional)
                </label>
                <input
                  type="datetime-local"
                  value={formData.ends_at}
                  onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-2"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  id="is_active_featured"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="mr-2"
                />
                <label htmlFor="is_active_featured" className="text-sm font-medium" style={{ color: theme.colors.text.primary }}>
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
                {editing ? 'Update Featured Product' : 'Add Featured Product'}
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

      {/* Featured products list */}
      <div className="space-y-4">
        {featuredProducts.map((featured) => (
          <div key={featured.id} className="p-4 border rounded-lg" style={{ 
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.glass.border 
          }}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold" style={{ color: theme.colors.text.primary }}>
                    {featured.title || featured.product?.title || 'Untitled Product'}
                  </h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getFeatureTypeColor(featured.feature_type)}`}>
                    {featureTypes.find(t => t.value === featured.feature_type)?.label}
                  </span>
                  <span className="text-xs px-2 py-1 rounded" style={{ 
                    backgroundColor: featured.is_active && !isExpired(featured.ends_at) 
                      ? 'rgb(34 197 94 / 0.1)' : 'rgb(239 68 68 / 0.1)',
                    color: featured.is_active && !isExpired(featured.ends_at) 
                      ? 'rgb(34 197 94)' : 'rgb(239 68 68)'
                  }}>
                    {!featured.is_active ? 'Inactive' : isExpired(featured.ends_at) ? 'Expired' : 'Active'}
                  </span>
                </div>
                
                {featured.description && (
                  <p className="text-sm mb-2" style={{ color: theme.colors.text.secondary }}>
                    {featured.description}
                  </p>
                )}
                
                <div className="flex items-center gap-4 text-xs" style={{ color: theme.colors.text.secondary }}>
                  <span>Order: {featured.sort_order}</span>
                  <span>Starts: {new Date(featured.starts_at).toLocaleDateString()}</span>
                  {featured.ends_at && (
                    <span>Ends: {new Date(featured.ends_at).toLocaleDateString()}</span>
                  )}
                  {featured.product && (
                    <span className="font-medium">${featured.product.base_price}</span>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(featured)}
                  className="text-sm px-3 py-1 rounded border transition-all"
                  style={{
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(featured.id, featured.title || featured.product?.title || 'Product')}
                  className="text-sm px-3 py-1 rounded text-red-500 border border-red-200 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {featuredProducts.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4" style={{ color: theme.colors.accent }}>⭐</div>
          <h3 className="text-xl font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
            No Featured Products Yet
          </h3>
          <p style={{ color: theme.colors.text.secondary }}>
            {brand === 'primediscreet' 
              ? 'Showcase your elite products to attract premium customers'
              : 'Feature products to boost visibility and sales'
            }
          </p>
        </div>
      )}
    </div>
  )
}