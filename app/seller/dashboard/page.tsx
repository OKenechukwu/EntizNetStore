import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import SellerDashboard from '@/components/seller/SellerDashboard'

export default async function SellerDashboardPage() {
  const supabase = createServerComponentClient({ cookies })
  
  // Check authentication
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    redirect('/auth/signin?redirect=/seller/dashboard')
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

  // Get seller analytics data
  const [productsData, ordersData, reviewsData] = await Promise.all([
    // Get seller's products with brand info
    supabase
      .from('products')
      .select(`
        id, title, marketplace_brand, status, base_price, created_at,
        product_variants(inventory_quantity),
        product_media(url)
      `)
      .eq('seller_id', session.user.id)
      .order('created_at', { ascending: false }),

    // Get recent orders
    supabase
      .from('orders')
      .select(`
        id, order_number, status, total_cents, created_at,
        order_items(product_title, quantity)
      `)
      .eq('seller_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(10),

    // Get recent reviews
    supabase
      .from('reviews')
      .select(`
        id, rating, title, content, created_at,
        products(title, marketplace_brand)
      `)
      .in('product_id', 
        supabase.from('products').select('id').eq('seller_id', session.user.id)
      )
      .order('created_at', { ascending: false })
      .limit(5)
  ])

  return (
    <SellerDashboard 
      sellerProfile={sellerProfile}
      products={productsData.data || []}
      orders={ordersData.data || []}
      reviews={reviewsData.data || []}
    />
  )
}