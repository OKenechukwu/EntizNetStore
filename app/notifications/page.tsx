import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import NotificationsPage from '@/components/notifications/NotificationsPage'

export default async function NotificationsPageWrapper() {
  const supabase = createServerComponentClient({ cookies })
  
  // Check authentication
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    redirect('/auth/signin?redirect=/notifications')
  }

  return <NotificationsPage />
}