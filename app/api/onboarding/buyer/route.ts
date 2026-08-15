import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

// Trusted buyer onboarding: creates the canonical profiles_buyer row for the
// authenticated user only. Identity comes exclusively from the server-validated
// auth user — client-supplied IDs are never accepted.
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Optional, safe, self-descriptive fields only. Never an ID.
    let displayName: string | null = null
    try {
      const body = await request.json()
      if (typeof body?.display_name === 'string') {
        displayName = body.display_name.trim().slice(0, 80) || null
      }
    } catch {
      // no/invalid body is fine
    }

    const admin = getSupabaseAdmin()

    // Idempotent: if the profile already exists, return it unchanged.
    const { data: existing } = await admin
      .from('profiles_buyer')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ ok: true, created: false })
    }

    const { error: insertError } = await admin.from('profiles_buyer').insert({
      id: user.id,
      display_name: displayName ?? user.email?.split('@')[0] ?? null,
    })

    // Unique violation = concurrent onboarding; treat as success (idempotent).
    if (insertError && insertError.code !== '23505') {
      console.error('Buyer onboarding failed:', insertError.message)
      return NextResponse.json({ error: 'Failed to create buyer profile' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, created: !insertError })
  } catch (error) {
    console.error('Buyer onboarding error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
