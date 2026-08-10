import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { searchParams } = new URL(request.url)
    const brand = searchParams.get('brand') || 'entiznetstore'
    
    // Verify trusted admin (server-validated user + app_metadata role)
    const { errorResponse } = await requireAdmin()
    if (errorResponse) return errorResponse

    // Get featured products with product details
    const { data, error } = await supabase
      .from('featured_products')
      .select(`
        *,
        product:products(title, base_price, marketplace_brand, status)
      `)
      .eq('marketplace_brand', brand)
      .order('sort_order')
    
    if (error) {
      throw error
    }

    return NextResponse.json({ featuredProducts: data || [] })

  } catch (error: any) {
    console.error('Error fetching featured products:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch featured products' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    
    // Verify trusted admin (server-validated user + app_metadata role)
    const { errorResponse } = await requireAdmin()
    if (errorResponse) return errorResponse

    const body = await request.json()
    const { 
      product_id, 
      marketplace_brand, 
      feature_type, 
      title, 
      description, 
      image_url, 
      link_url, 
      sort_order, 
      is_active, 
      starts_at, 
      ends_at 
    } = body

    if (!product_id || !feature_type) {
      return NextResponse.json(
        { error: 'Product ID and feature type are required' },
        { status: 400 }
      )
    }

    // Verify the product exists and belongs to the correct brand
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('marketplace_brand, status')
      .eq('id', product_id)
      .single()

    if (productError || !product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    if (product.marketplace_brand !== marketplace_brand) {
      return NextResponse.json(
        { error: 'Product does not belong to the specified marketplace brand' },
        { status: 400 }
      )
    }

    if (product.status !== 'active') {
      return NextResponse.json(
        { error: 'Only active products can be featured' },
        { status: 400 }
      )
    }

    // Create featured product
    const { data, error } = await supabase
      .from('featured_products')
      .insert({
        product_id,
        marketplace_brand,
        feature_type,
        title: title || null,
        description: description || null,
        image_url: image_url || null,
        link_url: link_url || null,
        sort_order: sort_order || 0,
        is_active: is_active ?? true,
        starts_at: starts_at ? new Date(starts_at).toISOString() : new Date().toISOString(),
        ends_at: ends_at ? new Date(ends_at).toISOString() : null,
        metadata: {}
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ featuredProduct: data })

  } catch (error: any) {
    console.error('Error creating featured product:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create featured product' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    
    // Verify trusted admin (server-validated user + app_metadata role)
    const { errorResponse } = await requireAdmin()
    if (errorResponse) return errorResponse

    const body = await request.json()
    const { 
      id,
      product_id, 
      feature_type, 
      title, 
      description, 
      image_url, 
      link_url, 
      sort_order, 
      is_active, 
      starts_at, 
      ends_at 
    } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Featured product ID is required' },
        { status: 400 }
      )
    }

    // Update featured product
    const { data, error } = await supabase
      .from('featured_products')
      .update({
        product_id,
        feature_type,
        title: title || null,
        description: description || null,
        image_url: image_url || null,
        link_url: link_url || null,
        sort_order: sort_order || 0,
        is_active: is_active ?? true,
        starts_at: starts_at ? new Date(starts_at).toISOString() : new Date().toISOString(),
        ends_at: ends_at ? new Date(ends_at).toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ featuredProduct: data })

  } catch (error: any) {
    console.error('Error updating featured product:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update featured product' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    
    // Verify trusted admin (server-validated user + app_metadata role)
    const { errorResponse } = await requireAdmin()
    if (errorResponse) return errorResponse

    const { searchParams } = new URL(request.url)
    const featuredId = searchParams.get('id')

    if (!featuredId) {
      return NextResponse.json(
        { error: 'Featured product ID is required' },
        { status: 400 }
      )
    }

    // Delete featured product
    const { error } = await supabase
      .from('featured_products')
      .delete()
      .eq('id', featuredId)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Error deleting featured product:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete featured product' },
      { status: 500 }
    )
  }
}