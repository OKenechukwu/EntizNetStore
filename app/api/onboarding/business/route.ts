import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const BUSINESS_KINDS = [
  'brand',
  'supplier',
  'manufacturer',
  'distributor',
  'wholesaler',
  'retailer',
  'other',
] as const;
type BusinessKind = (typeof BUSINESS_KINDS)[number];

// Canonical Business/BSM onboarding. BSM is an additive capability and retains
// the baseline Buyer capability. It never overwrites Seller capability.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let displayName: string | null = null;
    let businessKind: BusinessKind = 'brand';
    try {
      const body = await request.json();
      if (typeof body?.display_name === 'string') {
        displayName = body.display_name.trim().slice(0, 120) || null;
      }
      if (BUSINESS_KINDS.includes(body?.business_kind as BusinessKind)) {
        businessKind = body.business_kind as BusinessKind;
      }
    } catch {
      // Empty body is valid.
    }

    const admin = getSupabaseAdmin();
    const fallbackName = user.email?.split('@')[0] ?? 'business';

    const { error: buyerError } = await admin.from('profiles_buyer').upsert(
      { id: user.id, display_name: fallbackName },
      { onConflict: 'id', ignoreDuplicates: true },
    );
    if (buyerError) {
      console.error('Business onboarding buyer capability failed:', buyerError.message);
      return NextResponse.json({ error: 'Failed to provision buyer capability' }, { status: 500 });
    }

    const { data: existing } = await admin
      .from('profiles_business')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!existing) {
      const { error: businessError } = await admin.from('profiles_business').insert({
        id: user.id,
        display_name: displayName ?? fallbackName,
        business_kind: businessKind,
        verification_status: 'pending',
      });
      if (businessError && businessError.code !== '23505') {
        console.error('Business onboarding failed:', businessError.message);
        return NextResponse.json({ error: 'Failed to create business capability' }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, created: !existing });
  } catch (error) {
    console.error('Business onboarding error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
