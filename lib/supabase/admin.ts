// Server-only Supabase privileged client.
// Must NEVER be imported from Client Components or any browser bundle.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

if (typeof window !== 'undefined') {
  throw new Error('lib/supabase/admin.ts is server-only and must never be imported in client code')
}

let cached: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  // Prefer Supabase's current backend-only secret key. Keep the legacy service
  // role fallback during the controlled key migration; neither value may ever
  // use a NEXT_PUBLIC_* name or enter a browser bundle.
  const privilegedKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('Supabase URL is not configured')
  }
  if (!privilegedKey) {
    throw new Error('SUPABASE_SECRET_KEY or legacy SUPABASE_SERVICE_ROLE_KEY is required on the server')
  }

  cached = createClient(url, privilegedKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  return cached
}