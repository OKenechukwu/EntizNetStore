// Server-only admin authorization helper.
// Admin privilege comes ONLY from trusted app_metadata (set via the Supabase
// Admin API / service role), never from client-mutable user_metadata.
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase/server'

export type RequireAdminResult =
  | { user: User; errorResponse: null }
  | { user: null; errorResponse: NextResponse }

export async function requireAdmin(): Promise<RequireAdminResult> {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      user: null,
      errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  if (user.app_metadata?.role !== 'admin') {
    return {
      user: null,
      errorResponse: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { user, errorResponse: null }
}
