import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const BUSINESS_TYPES = ['individual', 'business', 'creator'] as const;
type BusinessType = (typeof BUSINESS_TYPES)[number];

function requiredDocumentsFor(type: BusinessType) {
  return type === 'business'
    ? ['identity', 'business_license', 'tax_document', 'address_proof']
    : ['identity', 'address_proof'];
}

// Seller is an additive capability. Every seller is also provisioned with the
// baseline Buyer capability so they can buy without a role switch or second
// account. Identity and verification state are server-controlled.
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

    let storefrontName: string | null = null;
    let businessType: BusinessType = 'individual';
    try {
      const body = await request.json();
      if (typeof body?.storefront_name === 'string') {
        storefrontName = body.storefront_name.trim().slice(0, 120) || null;
      }
      if (BUSINESS_TYPES.includes(body?.business_type as BusinessType)) {
        businessType = body.business_type as BusinessType;
      }
    } catch {
      // Empty body is valid.
    }

    const admin = getSupabaseAdmin();
    const fallbackName = user.email?.split('@')[0] ?? 'member';

    // Buyer is the canonical baseline capability for all marketplace accounts.
    const { error: buyerError } = await admin.from('profiles_buyer').upsert(
      { id: user.id, display_name: fallbackName },
      { onConflict: 'id', ignoreDuplicates: true },
    );
    if (buyerError) {
      console.error('Seller onboarding buyer capability failed:', buyerError.message);
      return NextResponse.json({ error: 'Failed to provision buyer capability' }, { status: 500 });
    }

    const { data: existing } = await admin
      .from('profiles_seller')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!existing) {
      const { error: sellerError } = await admin.from('profiles_seller').insert({
        id: user.id,
        storefront_name: storefrontName ?? `${fallbackName}'s Store`,
        business_type: businessType,
        verification_status: 'pending',
      });
      if (sellerError && sellerError.code !== '23505') {
        console.error('Seller onboarding failed:', sellerError.message);
        return NextResponse.json({ error: 'Failed to create seller capability' }, { status: 500 });
      }
    }

    const { error: privateError } = await admin.from('profiles_seller_private').upsert(
      { seller_id: user.id },
      { onConflict: 'seller_id', ignoreDuplicates: true },
    );
    if (privateError) {
      console.error('Seller private profile failed:', privateError.message);
      return NextResponse.json({ error: 'Failed to create seller private profile' }, { status: 500 });
    }

    // Ensure there is always an actionable KYC request for a new seller.
    const { error: kycError } = await admin.from('kyc_verification_requests').upsert(
      {
        seller_id: user.id,
        verification_status: 'incomplete',
        required_documents: requiredDocumentsFor(businessType),
        submitted_documents: [],
      },
      { onConflict: 'seller_id', ignoreDuplicates: true },
    );
    if (kycError) {
      console.error('Seller KYC request provisioning failed:', kycError.message);
      return NextResponse.json({ error: 'Failed to initialize seller verification' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, created: !existing });
  } catch (error) {
    console.error('Seller onboarding error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
