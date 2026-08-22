import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const BUCKET = 'kyc-documents';

// Seller-only access to the seller's own private KYC object. The bucket remains
// private; a short-lived URL is minted only after server-side ownership checks.
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const documentId = request.nextUrl.searchParams.get('id');
  if (!documentId) {
    return NextResponse.json({ error: 'Document id is required' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: document, error: documentError } = await admin
    .from('kyc_documents')
    .select('id, seller_id, file_path, file_name, mime_type')
    .eq('id', documentId)
    .maybeSingle();
  if (documentError || !document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }
  if (document.seller_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(document.file_path, 120);
  if (error || !data?.signedUrl) {
    console.error('KYC document signing failed:', error);
    return NextResponse.json({ error: 'Unable to create document link' }, { status: 500 });
  }

  return NextResponse.json({
    url: data.signedUrl,
    expiresIn: 120,
    fileName: document.file_name,
    mimeType: document.mime_type,
  });
}
