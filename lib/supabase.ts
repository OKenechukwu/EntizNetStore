// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import { getSupabaseClient } from './supabase/client'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!

// Use the singleton client from lib/supabase/client.ts to avoid multiple instances
export const supabase = getSupabaseClient()

// Server-side Supabase instance  
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)