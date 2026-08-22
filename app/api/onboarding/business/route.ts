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

const BUSINESS_KYC_DOCUMENTS = [
  'identity',
  'business_license',
  'tax_document',
  'address_proof',
] as const;

// Canonical Business/BSM onboarding. A BSM account is a commercial marketplace
// capability, so it is provisioned as Buyer + Seller + Business on one identity.
// This keeps Business/BSM distinct for profile/verification purposes without
// forcing a second account or leaving a BSM unable to list products.
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
    const resolvedName = displayName ?? fallbackName;

    const [{ data: existingBusiness }, { data: existingSeller }, { data: existingRequest }] =
      await Promise.all([
        admin
          .from('profiles_business')
          .select('id, verification_status')
          .eq('id', user.id)
          .maybeSingle(),
        admin
          .from('profiles_seller')
          .select('id, business_type, verification_status')
          .eq('id', user.id)
          .maybeSingle(),
        admin
          .from('kyc_verification_requests')
          .select('id')
          .eq('seller_id', user.id)
          .maybeSingle(),
      ]);

    const { error: buyerError } = await admin.from('profiles_buyer').upsert(
      { id: user.id, display_name: fallbackName },
      { onConflict: 'id', ignoreDuplicates: true },
    );
    if (buyerError) {
      console.error('Business onboarding buyer capability failed:', buyerError.message);
      return NextResponse.json({ error: 'Failed to provision buyer capability' }, { status: 500 });
    }

    if (!existingBusiness) {
      const { error: businessError } = await admin.from('profiles_business').insert({
        id: user.id,
        display_name: resolvedName,
        business_kind: businessKind,
        verification_status: 'pending',
      });
      if (businessError && businessError.code !== '23505') {
        console.error('Business onboarding failed:', businessError.message);
        return NextResponse.json({ error: 'Failed to create business capability' }, { status: 500 });
      }
    }

    if (!existingSeller) {
      const { error: sellerError } = await admin.from('profiles_seller').insert({
        id: user.id,
        storefront_name: resolvedName,
        business_type: 'business',
        verification_status: 'pending',
      });
      if (sellerError && sellerError.code !== '23505') {
        console.error('Business seller-capability provisioning failed:', sellerError.message);
        return NextResponse.json({ error: 'Failed to create seller capability' }, { status: 500 });
      }
    } else if (!existingBusiness && existingSeller.business_type !== 'business') {
      // Adding BSM to an existing individual/creator seller changes the entity
      // being verified. Require business-grade KYC again rather than inheriting
      // an individual verification decision.
      const nextStatus = existingSeller.verification_status === 'suspended' ? 'suspended' : 'pending';
      const { error: sellerUpgradeError } = await admin
        .from('profiles_seller')
        .update({
          business_type: 'business',
          verification_status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (sellerUpgradeError) {
        console.error('Business seller-capability upgrade failed:', sellerUpgradeError.message);
        return NextResponse.json({ error: 'Failed to upgrade seller capability' }, { status: 500 });
      }
    }

    const { error: privateError } = await admin.from('profiles_seller_private').upsert(
      { seller_id: user.id },
      { onConflict: 'seller_id', ignoreDuplicates: true },
    );
    if (privateError) {
      console.error('Business seller private profile failed:', privateError.message);
      return NextResponse.json({ error: 'Failed to create seller private profile' }, { status: 500 });
    }

    // New BSM capability (or recovery from an older partial BSM account) must
    // use business-grade KYC. Existing document rows are retained and counted,
    // while prior final review state is reset only when the entity is upgraded.
    if (!existingBusiness || !existingSeller || !existingRequest) {
      const { data: documentRows, error: documentsError } = await admin
        .from('kyc_documents')
        .select('document_type')
        .eq('seller_id', user.id);
      if (documentsError) {
        console.error('Business KYC document inventory failed:', documentsError.message);
        return NextResponse.json({ error: 'Failed to initialize business verification' }, { status: 500 });
      }

      const submittedDocuments = Array.from(
        new Set((documentRows ?? []).map((row) => row.document_type).filter(Boolean)),
      );
      const isComplete = BUSINESS_KYC_DOCUMENTS.every((type) => submittedDocuments.includes(type));
      const requestStatus = isComplete ? 'under_review' : 'incomplete';

      const { error: kycError } = await admin.from('kyc_verification_requests').upsert(
        {
          seller_id: user.id,
          verification_status: requestStatus,
          required_documents: [...BUSINESS_KYC_DOCUMENTS],
          submitted_documents: submittedDocuments,
          review_date: null,
          reviewer_notes: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'seller_id' },
      );
      if (kycError) {
        console.error('Business KYC request provisioning failed:', kycError.message);
        return NextResponse.json({ error: 'Failed to initialize business verification' }, { status: 500 });
      }

      const { error: businessStatusError } = await admin
        .from('profiles_business')
        .update({
          verification_status: isComplete ? 'under_review' : 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (businessStatusError) {
        console.error('Business verification lifecycle initialization failed:', businessStatusError.message);
        return NextResponse.json({ error: 'Failed to initialize business verification' }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      created: !existingBusiness,
      capabilities: ['buyer', 'seller', 'business'],
    });
  } catch (error) {
    console.error('Business onboarding error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
