import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

// Trusted seller onboarding: creates the canonical profiles_seller row (always
// verification_status='pending') plus its profiles_seller_private row for the
// authenticated user only. Identity comes exclusively from the server-validated
// auth user; the client can never choose an ID or a verification status.
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

    // Optional, safe, self-descriptive fields only. Never an ID or status.
    let storefrontName: string | null = null
    try {
      const body = await request.json()
      if (typeof body?.storefront_name === 'string') {
        storefrontName = body.storefront_name.trim().slice(0, 120) || null
      }
    } catch {
      // no/invalid body is fine
    }

    const admin = getSupabaseAdmin()

    // Idempotent: if the seller profile already exists, keep it as-is
    // (never resetting verification_status), but ensure the private row exists.
    const { data: existing } = await admin
      .from('profiles_seller')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!existing) {
      const { error: insertError } = await admin.from('profiles_seller').insert({
        id: user.id,
        storefront_name:
          storefrontName ?? `${user.email?.split('@')[0] ?? 'seller'}'s Store`,
        verification_status: 'pending', // server-enforced, never client-supplied
      })

      if (insertError && insertError.code !== '23505') {
        console.error('Seller onboarding failed:', insertError.message)
        return NextResponse.json({ error: 'Failed to create seller profile' }, { status: 500 })
      }
    }

    const { error: privateError } = await admin
      .from('profiles_seller_private')
      .upsert({ seller_id: user.id }, { onConflict: 'seller_id', ignoreDuplicates: true })

    if (privateError) {
      console.error('Seller private profile failed:', privateError.message)
      return NextResponse.json({ error: 'Failed to create seller private profile' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, created: !existing })
  } catch (error) {
    console.error('Seller onboarding error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
