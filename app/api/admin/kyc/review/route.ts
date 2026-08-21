import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { validateMessageContent } from '@/lib/validation'

const DOCUMENT_REVIEW_STATUSES = ['approved', 'rejected'] as const
const VERIFICATION_FINAL_STATUSES = ['approved', 'rejected'] as const

type DocumentReviewStatus = (typeof DOCUMENT_REVIEW_STATUSES)[number]
type VerificationFinalStatus = (typeof VERIFICATION_FINAL_STATUSES)[number]

export async function POST(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireAdmin()
    if (errorResponse) return errorResponse

    const { action, documentId, requestId, status, reason, notes } = await request.json()

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    if (reason) {
      const validation = validateMessageContent(reason)
      if (!validation.isValid) {
        return NextResponse.json({ error: validation.errors[0] }, { status: 400 })
      }
    }

    if (notes) {
      const validation = validateMessageContent(notes)
      if (!validation.isValid) {
        return NextResponse.json({ error: validation.errors[0] }, { status: 400 })
      }
    }

    const admin = getSupabaseAdmin()

    switch (action) {
      case 'review_document': {
        if (!documentId || !DOCUMENT_REVIEW_STATUSES.includes(status as DocumentReviewStatus)) {
          return NextResponse.json(
            { error: 'Document ID and a valid review status are required' },
            { status: 400 },
          )
        }

        const reviewStatus = status as DocumentReviewStatus
        if (reviewStatus === 'rejected' && !reason) {
          return NextResponse.json({ error: 'A rejection reason is required' }, { status: 400 })
        }

        const { data: document, error: lookupError } = await admin
          .from('kyc_documents')
          .select('id, seller_id, verification_status')
          .eq('id', documentId)
          .maybeSingle()

        if (lookupError || !document) {
          return NextResponse.json({ error: 'Document not found' }, { status: 404 })
        }

        const { error: docError } = await admin
          .from('kyc_documents')
          .update({
            verification_status: reviewStatus,
            reviewed_at: new Date().toISOString(),
            reviewed_by: user.id,
            rejection_reason: reviewStatus === 'rejected' ? reason : null,
          })
          .eq('id', documentId)

        if (docError) throw docError

        await logAdminAction(user.id, 'document_review', {
          document_id: documentId,
          seller_id: document.seller_id,
          action: reviewStatus,
          reason: reviewStatus === 'rejected' ? reason : null,
        })

        return NextResponse.json({
          success: true,
          message: `Document ${reviewStatus} successfully`,
        })
      }

      case 'complete_verification': {
        if (!requestId || !VERIFICATION_FINAL_STATUSES.includes(status as VerificationFinalStatus)) {
          return NextResponse.json(
            { error: 'Request ID and a valid final status are required' },
            { status: 400 },
          )
        }

        const finalStatus = status as VerificationFinalStatus
        if (finalStatus === 'rejected' && !notes) {
          return NextResponse.json({ error: 'Reviewer notes are required for rejection' }, { status: 400 })
        }

        const { data: requestData, error: requestLookupError } = await admin
          .from('kyc_verification_requests')
          .select('id, seller_id, required_documents, submitted_documents')
          .eq('id', requestId)
          .maybeSingle()

        if (requestLookupError || !requestData) {
          return NextResponse.json({ error: 'Verification request not found' }, { status: 404 })
        }

        if (finalStatus === 'approved') {
          const required = requestData.required_documents ?? []
          const { data: documents, error: documentsError } = await admin
            .from('kyc_documents')
            .select('document_type, verification_status')
            .eq('seller_id', requestData.seller_id)

          if (documentsError) throw documentsError

          const approvedTypes = new Set(
            (documents ?? [])
              .filter((document) => document.verification_status === 'approved')
              .map((document) => document.document_type),
          )
          const missingApproval = required.find((documentType: string) => !approvedTypes.has(documentType))

          if (missingApproval) {
            return NextResponse.json(
              { error: `Required document is not approved: ${missingApproval}` },
              { status: 409 },
            )
          }
        }

        const now = new Date().toISOString()
        const sellerStatus = finalStatus === 'approved' ? 'verified' : 'rejected'

        const { error: requestError } = await admin
          .from('kyc_verification_requests')
          .update({
            verification_status: finalStatus,
            review_date: now,
            reviewer_notes: notes || null,
          })
          .eq('id', requestId)

        if (requestError) throw requestError

        const { error: sellerError } = await admin
          .from('profiles_seller')
          .update({
            verification_status: sellerStatus,
            updated_at: now,
          })
          .eq('id', requestData.seller_id)

        if (sellerError) {
          // Avoid leaving the request approved when the seller capability could
          // not be promoted. Revert the request to an actionable review state.
          await admin
            .from('kyc_verification_requests')
            .update({
              verification_status: 'under_review',
              review_date: null,
            })
            .eq('id', requestId)
          throw sellerError
        }

        await logAdminAction(user.id, 'verification_complete', {
          request_id: requestId,
          seller_id: requestData.seller_id,
          action: finalStatus,
          seller_status: sellerStatus,
          notes: notes || null,
        })

        return NextResponse.json({
          success: true,
          message: `Verification ${finalStatus} successfully`,
        })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error in admin KYC review:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function logAdminAction(adminId: string, action: string, metadata: Record<string, unknown>) {
  try {
    const { error } = await getSupabaseAdmin()
      .from('admin_audit_logs')
      .insert({
        admin_id: adminId,
        action,
        target_type: getTargetType(action),
        target_id: getTargetId(metadata),
        metadata,
        timestamp: new Date().toISOString(),
      })

    if (error) {
      console.error('Error inserting audit log:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error logging admin action:', error)
    return false
  }
}

function getTargetType(action: string): string {
  switch (action) {
    case 'document_review':
      return 'kyc_document'
    case 'verification_complete':
      return 'verification_request'
    default:
      return 'unknown'
  }
}

function getTargetId(metadata: Record<string, unknown>): string {
  const value = metadata.document_id ?? metadata.request_id
  return typeof value === 'string' ? value : 'unknown'
}
