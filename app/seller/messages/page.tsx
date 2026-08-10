import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import MessageCenter from '@/components/messaging/MessageCenter'

export default async function SellerMessagesPage() {
  const supabase = createServerComponentClient({ cookies })
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/signin?redirect=/seller/messages')
  }

  // Check if user has seller profile
  const { data: sellerProfile } = await supabase
    .from('profiles_seller')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!sellerProfile) {
    redirect('/seller/apply')
  }

  return (
    <div className="h-screen">
      <MessageCenter 
        currentUserId={user.id}
        userType="seller"
      />
    </div>
  )
}