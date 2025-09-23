// lib/database.ts
import { supabase } from './supabase'

export type Category = {
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
}

export type Brand = {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  banner_url: string | null
  website: string | null
  is_verified: boolean
  metadata: any
  created_at: string
  updated_at: string
}

export type Product = {
  id: string
  seller_id: string
  brand_id: string | null
  title: string
  slug: string
  description: string | null
  short_description: string | null
  type: 'physical' | 'digital'
  status: 'draft' | 'active' | 'inactive' | 'archived'
  base_price: number
  compare_at_price: number | null
  cost_per_item: number | null
  track_inventory: boolean
  continue_selling: boolean
  requires_shipping: boolean
  is_taxable: boolean
  weight_grams: number | null
  material: string | null
  age_restriction: number
  tags: string[]
  search_keywords: string[]
  metadata: any
  created_at: string
  updated_at: string
}

export type ProductVariant = {
  id: string
  product_id: string
  title: string
  option1: string | null
  option2: string | null
  option3: string | null
  sku: string | null
  barcode: string | null
  price: number
  compare_at_price: number | null
  cost_per_item: number | null
  track_inventory: boolean
  inventory_quantity: number
  inventory_policy: 'deny' | 'continue'
  weight_grams: number | null
  requires_shipping: boolean
  is_active: boolean
  position: number
  created_at: string
  updated_at: string
}

export type ProductMedia = {
  id: string
  product_id: string
  variant_id: string | null
  type: 'image' | 'video'
  url: string
  alt_text: string | null
  caption: string | null
  position: number
  metadata: any
  created_at: string
}

// Category operations
export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  
  if (error) throw error
  return data || []
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()
  
  if (error) return null
  return data
}

export async function getSubcategories(parentId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('parent_id', parentId)
    .eq('is_active', true)
    .order('sort_order')
  
  if (error) throw error
  return data || []
}

// Brand operations
export async function getBrands(): Promise<Brand[]> {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .order('name')
  
  if (error) throw error
  return data || []
}

export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('slug', slug)
    .single()
  
  if (error) return null
  return data
}

// Product operations
export async function getProducts(filters?: {
  category?: string
  brand?: string
  status?: string
  limit?: number
  offset?: number
}): Promise<Product[]> {
  let query = supabase
    .from('products')
    .select(`
      *,
      brands(name, slug, is_verified),
      product_media(url, alt_text, type, position)
    `)
    .eq('status', 'active')
  
  if (filters?.category) {
    // Join with product_categories to filter by category slug
    query = supabase
      .from('products')
      .select(`
        *,
        brands(name, slug, is_verified),
        product_media(url, alt_text, type, position),
        product_categories!inner(
          categories!inner(slug, name)
        )
      `)
      .eq('status', 'active')
      .eq('categories.slug', filters.category)
  }
  
  if (filters?.brand) {
    query = query.eq('brands.slug', filters.brand)
  }
  
  if (filters?.limit) {
    query = query.limit(filters.limit)
  }
  
  if (filters?.offset) {
    query = query.range(filters.offset, (filters.offset + (filters.limit || 10)) - 1)
  }
  
  query = query.order('created_at', { ascending: false })
  
  const { data, error } = await query
  
  if (error) throw error
  return data || []
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      brands(*),
      product_variants(*),
      product_media(*),
      product_categories(categories(*))
    `)
    .eq('slug', slug)
    .eq('status', 'active')
    .single()
  
  if (error) return null
  return data
}

export async function getPopularProducts(limit = 10): Promise<Product[]> {
  // For now, get recent products - later we'll add view counts/sales data
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      brands(name, slug, is_verified),
      product_media(url, alt_text, type, position)
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) throw error
  return data || []
}

export async function getSaleProducts(limit = 10): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      brands(name, slug, is_verified),
      product_media(url, alt_text, type, position)
    `)
    .eq('status', 'active')
    .not('compare_at_price', 'is', null)
    .gt('compare_at_price', 0)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) throw error
  return data || []
}