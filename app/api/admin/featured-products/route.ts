import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await requireAdmin()
    if (errorResponse) return errorResponse

    const brand = new URL(request.url).searchParams.get('brand') || 'entiznetstore'
    const { data, error } = await getSupabaseAdmin()
      .from('featured_products')
      .select(`
        *,
        product:products(title, base_price, marketplace_brand, status)
      `)
      .eq('marketplace_brand', brand)
      .order('sort_order')

    if (error) throw error
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
    const { errorResponse } = await requireAdmin()
    if (errorResponse) return errorResponse

    const body = await request.json()
    const {
      product_id,
      marketplace_brand = 'entiznetstore',
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

    const admin = getSupabaseAdmin()
    const { data: product, error: productError } = await admin
      .from('products')
      .select('marketplace_brand, status')
      .eq('id', product_id)
      .maybeSingle()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
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

    const { data, error } = await admin
      .from('featured_products')
      .insert({
        product_id,
        marketplace_brand,
        feature_type,
        title: title || null,
        description: description || null,
        image_url: image_url || null,
        link_url: link_url || null,
        sort_order: Number.isInteger(sort_order) ? sort_order : 0,
        is_active: is_active ?? true,
        starts_at: starts_at ? new Date(starts_at).toISOString() : new Date().toISOString(),
        ends_at: ends_at ? new Date(ends_at).toISOString() : null,
        metadata: {}
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ featuredProduct: data }, { status: 201 })
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

    const { data, error } = await getSupabaseAdmin()
      .from('featured_products')
      .update({
        product_id,
        feature_type,
        title: title || null,
        description: description || null,
        image_url: image_url || null,
        link_url: link_url || null,
        sort_order: Number.isInteger(sort_order) ? sort_order : 0,
        is_active: is_active ?? true,
        starts_at: starts_at ? new Date(starts_at).toISOString() : new Date().toISOString(),
        ends_at: ends_at ? new Date(ends_at).toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
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
    const { errorResponse } = await requireAdmin()
    if (errorResponse) return errorResponse

    const featuredId = new URL(request.url).searchParams.get('id')
    if (!featuredId) {
      return NextResponse.json(
        { error: 'Featured product ID is required' },
        { status: 400 }
      )
    }

    const { error } = await getSupabaseAdmin()
      .from('featured_products')
      .delete()
      .eq('id', featuredId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting featured product:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete featured product' },
      { status: 500 }
    )
  }
}
