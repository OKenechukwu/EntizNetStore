import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const { errorResponse } = await requireAdmin();
    if (errorResponse) return errorResponse;

    const admin = getSupabaseAdmin();
    const { data: requests, error: requestsError } = await admin
      .from('kyc_verification_requests')
      .select('*')
      .in('verification_status', ['pending', 'under_review'])
      .order('submission_date', { ascending: true });

    if (requestsError) throw requestsError;
    if (!requests?.length) {
      return NextResponse.json({ pendingReviews: [] });
    }

    const sellerIds = Array.from(new Set(requests.map((request) => request.seller_id)));
    const [documentsResult, sellersResult, businessesResult] = await Promise.all([
      admin
        .from('kyc_documents')
        .select('*')
        .in('seller_id', sellerIds)
        .order('uploaded_at', { ascending: false }),
      admin
        .from('profiles_seller')
        .select('id, storefront_name, business_type, verification_status')
        .in('id', sellerIds),
      admin
        .from('profiles_business')
        .select('id, display_name, legal_name, business_kind, verification_status, country, website')
        .in('id', sellerIds),
    ]);

    if (documentsResult.error) throw documentsResult.error;
    if (sellersResult.error) throw sellersResult.error;
    if (businessesResult.error) throw businessesResult.error;

    const documentsBySeller = new Map<string, any[]>();
    for (const document of documentsResult.data ?? []) {
      const current = documentsBySeller.get(document.seller_id) ?? [];
      current.push(document);
      documentsBySeller.set(document.seller_id, current);
    }

    const sellersById = new Map((sellersResult.data ?? []).map((seller) => [seller.id, seller]));
    const businessesById = new Map(
      (businessesResult.data ?? []).map((business) => [business.id, business]),
    );

    const pendingReviews = requests.flatMap((request) => {
      const seller = sellersById.get(request.seller_id);
      if (!seller) {
        console.error('KYC request has no Seller projection:', request.id, request.seller_id);
        return [];
      }
      return [
        {
          request,
          documents: documentsBySeller.get(request.seller_id) ?? [],
          seller,
          business: businessesById.get(request.seller_id) ?? null,
        },
      ];
    });

    return NextResponse.json({ pendingReviews });
  } catch (error) {
    console.error('Error loading pending reviews:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
