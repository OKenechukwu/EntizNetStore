// Product filtering utilities for dual brand architecture
'use client'

import { Brand } from './brand'

export interface ProductFilters {
  marketplaceBrand?: Brand
  category?: string
  priceRange?: {
    min: number
    max: number
  }
  tags?: string[]
  ageRestriction?: number
  isAdult?: boolean
  inStock?: boolean
}

export interface Product {
  id: string
  seller_id: string
  brand_id: string
  marketplace_brand: Brand
  title: string
  slug: string
  description: string
  short_description: string
  type: string
  status: string
  base_price: number
  compare_at_price?: number
  cost_per_item?: number
  track_inventory: boolean
  continue_selling: boolean
  requires_shipping: boolean
  is_taxable: boolean
  weight_grams?: number
  material?: string
  age_restriction?: number
  tags: string[]
  search_keywords: string[]
  metadata?: any
  created_at: string
  updated_at: string
}

// Filter products by marketplace brand
export function filterProductsByBrand(products: Product[], brand: Brand): Product[] {
  return products.filter(product => product.marketplace_brand === brand)
}

// Build Supabase query filters for brand-specific products
export function buildBrandQuery(brand: Brand, additionalFilters?: ProductFilters) {
  const filters = {
    marketplace_brand: brand,
    status: 'active',
    ...additionalFilters
  }

  return filters
}

// Get brand-specific product categories
export function getBrandCategories(brand: Brand): string[] {
  if (brand === 'primediscreet') {
    return [
      'Premium Intimate',
      'Luxury Collections', 
      'Discrete Accessories',
      'Elite Experiences',
      'Exclusive Editions'
    ]
  }

  // EntizNetStore categories
  return [
    'Adult Toys',
    'Intimate Apparel',
    'Wellness Products',
    'Accessories',
    'Games & Entertainment',
    'Health & Beauty',
    'Couples',
    'Books & Media'
  ]
}

// Get brand-specific pricing tiers
export function getBrandPricingTiers(brand: Brand): Array<{ label: string; min: number; max: number }> {
  if (brand === 'primediscreet') {
    // Premium discrete pricing tiers
    return [
      { label: 'Elite ($200+)', min: 200, max: 10000 },
      { label: 'Premium ($100-199)', min: 100, max: 199 },
      { label: 'Luxury ($50-99)', min: 50, max: 99 },
      { label: 'Selective ($25-49)', min: 25, max: 49 }
    ]
  }

  // EntizNetStore standard pricing tiers  
  return [
    { label: 'Luxury ($100+)', min: 100, max: 10000 },
    { label: 'Premium ($50-99)', min: 50, max: 99 },
    { label: 'Quality ($25-49)', min: 25, max: 49 },
    { label: 'Value ($10-24)', min: 10, max: 24 },
    { label: 'Budget ($0-9)', min: 0, max: 9 }
  ]
}

// Get brand-specific featured tags
export function getBrandTags(brand: Brand): string[] {
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

  // EntizNetStore tags
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

// Format price for brand display
export function formatBrandPrice(price: number, brand: Brand): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: brand === 'primediscreet' ? 2 : 0,
    maximumFractionDigits: 2
  })

  return formatter.format(price)
}

// Get brand-appropriate product descriptions
export function getBrandProductDescription(product: Product, brand: Brand): string {
  if (brand === 'primediscreet') {
    // More sophisticated, discrete language
    return product.short_description || product.description
  }

  // Standard EntizNetStore descriptions
  return product.short_description || product.description
}