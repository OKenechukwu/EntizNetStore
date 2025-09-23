import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import MessageCenter from '@/components/messaging/MessageCenter'

export default async function MessagesPage() {
  const supabase = createServerComponentClient({ cookies })
  
  // Check authentication
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    redirect('/auth/signin?redirect=/messages')
  }

  // Determine user type (buyer or seller)
  const [buyerProfile, sellerProfile] = await Promise.all([
    supabase
      .from('profiles_buyer')
      .select('*')
      .eq('id', session.user.id)
      .single(),
    supabase
      .from('profiles_seller')
      .select('*')
      .eq('id', session.user.id)
      .single()
  ])

  const userType = sellerProfile.data ? 'seller' : 'buyer'

  return (
    <div className="h-screen">
      <MessageCenter 
        currentUserId={session.user.id}
        userType={userType}
      />
    </div>
  )
}