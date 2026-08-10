import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    // Verify trusted admin (server-validated user + app_metadata role)
    const { user, errorResponse } = await requireAdmin()
    if (errorResponse) return errorResponse

    // Load pending verification requests using admin client
    const { data: requests, error: requestsError } = await getSupabaseAdmin()
      .from('kyc_verification_requests')
      .select('*')
      .in('verification_status', ['pending', 'under_review'])
      .order('submission_date', { ascending: true })

    if (requestsError) throw requestsError

    if (!requests || requests.length === 0) {
      return NextResponse.json({ pendingReviews: [] })
    }

    // Load associated documents and seller profiles
    const reviews: any[] = []
    
    for (const request of requests) {
      // Get documents for this request
      const { data: documents, error: documentsError } = await getSupabaseAdmin()
        .from('kyc_documents')
        .select('*')
        .eq('seller_id', request.seller_id)
        .order('uploaded_at', { ascending: false })

      if (documentsError) {
        console.error('Error loading documents:', documentsError)
        continue
      }

      // Get seller profile
      const { data: seller, error: sellerError } = await getSupabaseAdmin()
        .from('profiles_seller')
        .select('id, storefront_name, business_type, verification_status')
        .eq('id', request.seller_id)
        .single()

      if (sellerError) {
        console.error('Error loading seller profile:', sellerError)
        continue
      }

      if (documents && seller) {
        reviews.push({
          request,
          documents,
          seller
        })
      }
    }

    return NextResponse.json({ pendingReviews: reviews })

  } catch (error) {
    console.error('Error loading pending reviews:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}