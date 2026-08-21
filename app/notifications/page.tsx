import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import NotificationsPage from '@/components/notifications/NotificationsPage'

export default async function NotificationsPageWrapper() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/signin?redirect=/notifications')
  }

  return <NotificationsPage />
}
