import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const KYC_BUCKET = 'kyc-documents'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { errorResponse } = await requireAdmin()
    if (errorResponse) return errorResponse

    const { id: documentId } = await params
    const admin = getSupabaseAdmin()
    const { data: document, error: docError } = await admin
      .from('kyc_documents')
      .select('*')
      .eq('id', documentId)
      .maybeSingle()

    if (docError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const { data: signed, error: storageError } = await admin
      .storage
      .from(KYC_BUCKET)
      .createSignedUrl(document.file_path, 300)

    if (storageError) {
      console.error('Error generating KYC document URL:', storageError)
    }

    return NextResponse.json({
      document: {
        id: document.id,
        file_name: document.file_name,
        file_size: document.file_size,
        mime_type: document.mime_type,
        document_type: document.document_type,
        verification_status: document.verification_status,
        uploaded_at: document.uploaded_at,
      },
      viewUrl: signed?.signedUrl ?? null,
    })
  } catch (error) {
    console.error('Error fetching KYC document:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
