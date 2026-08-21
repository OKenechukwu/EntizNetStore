import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const { errorResponse } = await requireAdmin()
    if (errorResponse) return errorResponse

    const { data, error } = await getSupabaseAdmin()
      .from('categories')
      .select('*')
      .order('sort_order')

    if (error) throw error
    return NextResponse.json({ categories: data || [] })
  } catch (error: any) {
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { errorResponse } = await requireAdmin()
    if (errorResponse) return errorResponse

    const body = await request.json()
    const { name, slug, description, parent_id, is_active, sort_order } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    const finalSlug = String(slug || name)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    if (!finalSlug) {
      return NextResponse.json({ error: 'Category slug is invalid' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    const { data: existingCategory } = await admin
      .from('categories')
      .select('id')
      .eq('slug', finalSlug)
      .maybeSingle()

    if (existingCategory) {
      return NextResponse.json(
        { error: 'A category with this slug already exists' },
        { status: 409 }
      )
    }

    const { data, error } = await admin
      .from('categories')
      .insert({
        name: name.trim(),
        slug: finalSlug,
        description: description || null,
        parent_id: parent_id || null,
        is_adult: true,
        sort_order: Number.isInteger(sort_order) ? sort_order : 0,
        is_active: is_active ?? true,
        metadata: {}
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ category: data }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating category:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create category' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { errorResponse } = await requireAdmin()
    if (errorResponse) return errorResponse

    const body = await request.json()
    const { id, name, slug, description, parent_id, is_active, sort_order } = body

    if (!id || !name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Category ID and name are required' },
        { status: 400 }
      )
    }

    const finalSlug = String(slug || name)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    if (!finalSlug) {
      return NextResponse.json({ error: 'Category slug is invalid' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    const { data: existingCategory } = await admin
      .from('categories')
      .select('id')
      .eq('slug', finalSlug)
      .neq('id', id)
      .maybeSingle()

    if (existingCategory) {
      return NextResponse.json(
        { error: 'A category with this slug already exists' },
        { status: 409 }
      )
    }

    const { data, error } = await admin
      .from('categories')
      .update({
        name: name.trim(),
        slug: finalSlug,
        description: description || null,
        parent_id: parent_id || null,
        sort_order: Number.isInteger(sort_order) ? sort_order : 0,
        is_active: is_active ?? true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ category: data })
  } catch (error: any) {
    console.error('Error updating category:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update category' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { errorResponse } = await requireAdmin()
    if (errorResponse) return errorResponse

    const categoryId = new URL(request.url).searchParams.get('id')
    if (!categoryId) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    const [{ count: productCount }, { count: subcategoryCount }] = await Promise.all([
      admin
        .from('product_categories')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', categoryId),
      admin
        .from('categories')
        .select('*', { count: 'exact', head: true })
        .eq('parent_id', categoryId)
    ])

    if ((productCount || 0) > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category that has associated products' },
        { status: 409 }
      )
    }

    if ((subcategoryCount || 0) > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category that has subcategories' },
        { status: 409 }
      )
    }

    const { error } = await admin.from('categories').delete().eq('id', categoryId)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting category:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete category' },
      { status: 500 }
    )
  }
}
