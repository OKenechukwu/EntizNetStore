import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { validateMessageContent } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { action, documentId, requestId, status, reason, notes } = await request.json()

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    // Validate input content
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

    switch (action) {
      case 'review_document':
        if (!documentId || !status) {
          return NextResponse.json({ 
            error: 'Document ID and status are required' 
          }, { status: 400 })
        }

        // Update document status using admin client to bypass RLS
        const updateData: any = {
          verification_status: status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id
        }

        if (reason) {
          updateData.rejection_reason = reason
        }

        const { error: docError } = await supabaseAdmin
          .from('kyc_documents')
          .update(updateData)
          .eq('id', documentId)

        if (docError) throw docError

        // Log admin action to audit table
        await logAdminAction(user.id, 'document_review', {
          document_id: documentId,
          action: status,
          reason
        })

        return NextResponse.json({ 
          success: true, 
          message: `Document ${status} successfully` 
        })

      case 'complete_verification':
        if (!requestId || !status) {
          return NextResponse.json({ 
            error: 'Request ID and status are required' 
          }, { status: 400 })
        }

        // Get the seller ID for this request using admin client
        const { data: requestData } = await supabaseAdmin
          .from('kyc_verification_requests')
          .select('seller_id')
          .eq('id', requestId)
          .single()

        if (!requestData) {
          return NextResponse.json({ error: 'Verification request not found' }, { status: 404 })
        }

        // Update verification request using admin client
        const { error: requestError } = await supabaseAdmin
          .from('kyc_verification_requests')
          .update({
            verification_status: status,
            review_date: new Date().toISOString(),
            reviewer_notes: notes
          })
          .eq('id', requestId)

        if (requestError) throw requestError

        // Update seller profile using admin client
        const { error: sellerError } = await supabaseAdmin
          .from('profiles_seller')
          .update({ verification_status: status })
          .eq('id', requestData.seller_id)

        if (sellerError) throw sellerError

        // Log admin action
        await logAdminAction(user.id, 'verification_complete', {
          request_id: requestId,
          seller_id: requestData.seller_id,
          action: status,
          notes
        })

        return NextResponse.json({ 
          success: true, 
          message: `Verification ${status} successfully` 
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in admin KYC review:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to log admin actions to audit table
async function logAdminAction(adminId: string, action: string, metadata: any) {
  try {
    const { error } = await supabaseAdmin
      .from('admin_audit_logs')
      .insert({
        admin_id: adminId,
        action,
        target_type: getTargetType(action),
        target_id: getTargetId(metadata),
        metadata,
        timestamp: new Date().toISOString()
      })

    if (error) {
      console.error('Error inserting audit log:', error)
      return false
    }

    console.log('Admin Action Logged:', { adminId, action, metadata })
    return true
  } catch (error) {
    console.error('Error logging admin action:', error)
    return false
  }
}

// Helper to determine target type from action
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

// Helper to extract target ID from metadata
function getTargetId(metadata: any): string {
  return metadata.document_id || metadata.request_id || 'unknown'
}