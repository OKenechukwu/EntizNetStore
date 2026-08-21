import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import ProductForm from '@/components/products/ProductForm'

export default async function NewProductPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/signin?redirect=/seller/products/new')
  }

  const { data: sellerProfile } = await supabase
    .from('profiles_seller')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (!sellerProfile) {
    redirect('/seller/apply')
  }

  const [categoriesData, brandsData] = await Promise.all([
    supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('brands').select('*').order('name'),
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
          sellerId={user.id}
          mode="create"
        />
      </div>
    </div>
  )
}
