import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import EnhancedMessageCenter from '@/components/messaging/EnhancedMessageCenter'

export default async function MessagesPage({
  searchParams,
}: {
  searchParams?: { conversation?: string };
}) {
  const supabase = createServerComponentClient({ cookies })
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/signin?redirect=/messages')
  }

  // Determine user type (buyer or seller)
  const [buyerProfile, sellerProfile] = await Promise.all([
    supabase
      .from('profiles_buyer')
      .select('*')
      .eq('id', user.id)
      .single(),
    supabase
      .from('profiles_seller')
      .select('*')
      .eq('id', user.id)
      .single()
  ])

  const userType = sellerProfile.data ? 'seller' : 'buyer'

  return (
    <div className="h-screen">
      <EnhancedMessageCenter 
        currentUserId={user.id}
        userType={userType}
        initialConversationId={searchParams?.conversation}
      />
    </div>
  )
}
