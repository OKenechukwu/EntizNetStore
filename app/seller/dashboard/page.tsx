import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import SellerDashboard from '@/components/seller/SellerDashboard'
import { getSellerDashboardData } from '@/lib/data/products'

export default async function SellerDashboardPage() {
  const supabase = createServerComponentClient({ cookies })

  // Check authentication before loading seller-owned Supabase data.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/signin?redirect=/seller/dashboard')
  }

  // Load seller profile + analytics data from the live database
  const { sellerProfile, products, orders, reviews } =
    await getSellerDashboardData(user.id)

  if (!sellerProfile) {
    redirect('/seller/apply')
  }

  return (
    <SellerDashboard
      sellerProfile={sellerProfile}
      products={products}
      orders={orders}
      reviews={reviews}
    />
  )
}
