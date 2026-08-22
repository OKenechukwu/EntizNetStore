import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { validateMessageContent } from '@/lib/validation';

const DOCUMENT_REVIEW_STATUSES = ['approved', 'rejected'] as const;
const VERIFICATION_FINAL_STATUSES = ['approved', 'rejected'] as const;
type DocumentReviewStatus = (typeof DOCUMENT_REVIEW_STATUSES)[number];
type VerificationFinalStatus = (typeof VERIFICATION_FINAL_STATUSES)[number];

function rpcErrorResponse(message: string) {
  if (message.includes('not_found')) {
    return NextResponse.json({ error: 'KYC record not found' }, { status: 404 });
  }
  if (message.includes('already_reviewed') || message.includes('already_final')) {
    return NextResponse.json({ error: 'This KYC record has already been reviewed' }, { status: 409 });
  }
  if (message.includes('required_document_not_approved:')) {
    const missing = message.split('required_document_not_approved:')[1]?.split(/\s|\n/)[0] ?? 'unknown';
    return NextResponse.json({ error: `Required document is not approved: ${missing}` }, { status: 409 });
  }
  return NextResponse.json({ error: 'Unable to complete KYC review' }, { status: 400 });
}

export async function POST(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireAdmin();
    if (errorResponse) return errorResponse;

    const { action, documentId, requestId, status, reason, notes } = await request.json();
    if (!action) return NextResponse.json({ error: 'Action is required' }, { status: 400 });

    if (reason) {
      const validation = validateMessageContent(reason);
      if (!validation.isValid) {
        return NextResponse.json({ error: validation.errors[0] }, { status: 400 });
      }
    }
    if (notes) {
      const validation = validateMessageContent(notes);
      if (!validation.isValid) {
        return NextResponse.json({ error: validation.errors[0] }, { status: 400 });
      }
    }

    const admin = getSupabaseAdmin();

    if (action === 'review_document') {
      if (!documentId || !DOCUMENT_REVIEW_STATUSES.includes(status as DocumentReviewStatus)) {
        return NextResponse.json(
          { error: 'Document ID and a valid review status are required' },
          { status: 400 },
        );
      }
      if (status === 'rejected' && !reason) {
        return NextResponse.json({ error: 'A rejection reason is required' }, { status: 400 });
      }

      const { error } = await admin.rpc('admin_review_kyc_document', {
        p_admin_id: user.id,
        p_document_id: documentId,
        p_status: status,
        p_reason: status === 'rejected' ? reason : null,
      });
      if (error) return rpcErrorResponse(error.message);
      return NextResponse.json({ success: true, message: `Document ${status} successfully` });
    }

    if (action === 'complete_verification') {
      if (!requestId || !VERIFICATION_FINAL_STATUSES.includes(status as VerificationFinalStatus)) {
        return NextResponse.json(
          { error: 'Request ID and a valid final status are required' },
          { status: 400 },
        );
      }
      if (status === 'rejected' && !notes) {
        return NextResponse.json({ error: 'Reviewer notes are required for rejection' }, { status: 400 });
      }

      const { error } = await admin.rpc('admin_complete_seller_kyc', {
        p_admin_id: user.id,
        p_request_id: requestId,
        p_status: status,
        p_notes: notes || null,
      });
      if (error) return rpcErrorResponse(error.message);
      return NextResponse.json({ success: true, message: `Verification ${status} successfully` });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in admin KYC review:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
