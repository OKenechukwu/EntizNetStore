import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    
    // Check if user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get all categories with subcategory structure
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order')
    
    if (error) {
      throw error
    }

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
    const supabase = createServerComponentClient({ cookies })
    
    // Check if user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, slug, description, parent_id, is_active, sort_order } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      )
    }

    // Generate slug if not provided
    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

    // Check if slug already exists
    const { data: existingCategory } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', finalSlug)
      .single()

    if (existingCategory) {
      return NextResponse.json(
        { error: 'A category with this slug already exists' },
        { status: 400 }
      )
    }

    // Create category
    const { data, error } = await supabase
      .from('categories')
      .insert({
        name,
        slug: finalSlug,
        description: description || null,
        parent_id: parent_id || null,
        is_adult: true, // Adult marketplace
        sort_order: sort_order || 0,
        is_active: is_active ?? true,
        metadata: {}
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ category: data })

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
    const supabase = createServerComponentClient({ cookies })
    
    // Check if user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { id, name, slug, description, parent_id, is_active, sort_order } = body

    if (!id || !name) {
      return NextResponse.json(
        { error: 'Category ID and name are required' },
        { status: 400 }
      )
    }

    // Generate slug if not provided
    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

    // Check if slug already exists (excluding current category)
    const { data: existingCategory } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', finalSlug)
      .neq('id', id)
      .single()

    if (existingCategory) {
      return NextResponse.json(
        { error: 'A category with this slug already exists' },
        { status: 400 }
      )
    }

    // Update category
    const { data, error } = await supabase
      .from('categories')
      .update({
        name,
        slug: finalSlug,
        description: description || null,
        parent_id: parent_id || null,
        sort_order: sort_order || 0,
        is_active: is_active ?? true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw error
    }

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
    const supabase = createServerComponentClient({ cookies })
    
    // Check if user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('id')

    if (!categoryId) {
      return NextResponse.json(
        { error: 'Category ID is required' },
        { status: 400 }
      )
    }

    // Check if category has products
    const { count: productCount } = await supabase
      .from('product_categories')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', categoryId)

    if (productCount && productCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category that has associated products' },
        { status: 400 }
      )
    }

    // Check if category has subcategories
    const { count: subcategoryCount } = await supabase
      .from('categories')
      .select('*', { count: 'exact', head: true })
      .eq('parent_id', categoryId)

    if (subcategoryCount && subcategoryCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category that has subcategories' },
        { status: 400 }
      )
    }

    // Delete category
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Error deleting category:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete category' },
      { status: 500 }
    )
  }
}