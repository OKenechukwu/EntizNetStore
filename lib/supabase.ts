// lib/supabase.ts
import { getSupabaseClient } from './supabase/client'

// Re-export the singleton client
export const supabase = getSupabaseClient()