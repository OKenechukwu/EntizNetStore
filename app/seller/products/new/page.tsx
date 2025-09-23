import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import ProductForm from '@/components/products/ProductForm'

export default async function NewProductPage() {
  const supabase = createServerComponentClient({ cookies })
  
  // Check authentication
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    redirect('/auth/signin?redirect=/seller/products/new')
  }

  // Check if user has seller profile
  const { data: sellerProfile } = await supabase
    .from('profiles_seller')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (!sellerProfile) {
    redirect('/seller/apply')
  }

  // Get categories and brands for the form
  const [categoriesData, brandsData] = await Promise.all([
    supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('brands')
      .select('*')
      .order('name')
  ])

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Add New Product</h1>
          <p className="mt-2 text-gray-600">
            Create a new product for your storefront with variants, media, and brand-specific categorization.
          </p>
        </div>

        <ProductForm 
          categories={categoriesData.data || []}
          brands={brandsData.data || []}
          sellerId={session.user.id}
          mode="create"
        />
      </div>
    </div>
  )
}