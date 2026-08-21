import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import MessageCenter from '@/components/messaging/MessageCenter'

export default async function SellerMessagesPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/signin?redirect=/seller/messages')
  }

  const { data: sellerProfile } = await supabase
    .from('profiles_seller')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (!sellerProfile) {
    redirect('/seller/apply')
  }

  return (
    <div className="h-screen">
      <MessageCenter currentUserId={user.id} userType="seller" />
    </div>
  )
}
