import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import EnhancedMessageCenter from '@/components/messaging/EnhancedMessageCenter'

export default async function MessagesPage({
  searchParams,
}: {
  searchParams?: Promise<{ conversation?: string }>
}) {
  const params = searchParams ? await searchParams : {}
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/signin?redirect=/messages')
  }

  const sellerProfile = await supabase
    .from('profiles_seller')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <div className="h-screen">
      <EnhancedMessageCenter
        currentUserId={user.id}
        userType={sellerProfile.data ? 'seller' : 'buyer'}
        initialConversationId={params.conversation}
      />
    </div>
  )
}
