import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

function requiredDocumentsFor(type: string | null | undefined) {
  return type === 'business'
    ? ['identity', 'business_license', 'tax_document', 'address_proof']
    : ['identity', 'address_proof'];
}

export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: seller } = await supabase
      .from('profiles_seller')
      .select('id, business_type, verification_status')
      .eq('id', user.id)
      .maybeSingle();
    if (!seller) {
      return NextResponse.json({ error: 'Seller capability required' }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    let { data: verificationRequest, error: requestError } = await admin
      .from('kyc_verification_requests')
      .select('*')
      .eq('seller_id', user.id)
      .maybeSingle();

    if (requestError) throw requestError;

    // Defensive fallback for pre-M1 or partially migrated seller identities.
    if (!verificationRequest) {
      const { data: created, error: createError } = await admin
        .from('kyc_verification_requests')
        .insert({
          seller_id: user.id,
          verification_status: 'incomplete',
          required_documents: requiredDocumentsFor(seller.business_type),
          submitted_documents: [],
        })
        .select('*')
        .single();
      if (createError) throw createError;
      verificationRequest = created;
    }

    const { data: documents, error: documentsError } = await admin
      .from('kyc_documents')
      .select(
        'id, document_type, file_name, file_size, mime_type, verification_status, rejection_reason, uploaded_at, reviewed_at',
      )
      .eq('seller_id', user.id)
      .order('uploaded_at', { ascending: false });
    if (documentsError) throw documentsError;

    return NextResponse.json({
      sellerStatus: seller.verification_status,
      verificationRequest,
      documents: documents ?? [],
    });
  } catch (error) {
    console.error('Unable to load seller KYC status:', error);
    return NextResponse.json({ error: 'Unable to load verification status' }, { status: 500 });
  }
}
