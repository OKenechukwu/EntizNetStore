import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { ObjectStorageService } from '@/server/objectStorage'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication and admin role
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const documentId = params.id

    // Get document details using admin client
    const { data: document, error: docError } = await supabaseAdmin
      .from('kyc_documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (docError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Generate secure presigned URL for document viewing
    const objectStorageService = new ObjectStorageService()
    
    try {
      // Generate a secure, time-limited URL for document access
      const presignedUrl = await objectStorageService.getDocumentDownloadURL(
        document.file_path,
        'admin_view',
        300 // 5 minutes expiry
      )

      return NextResponse.json({
        document: {
          id: document.id,
          file_name: document.file_name,
          file_size: document.file_size,
          mime_type: document.mime_type,
          document_type: document.document_type,
          verification_status: document.verification_status,
          uploaded_at: document.uploaded_at
        },
        viewUrl: presignedUrl
      })

    } catch (storageError) {
      console.error('Error generating document URL:', storageError)
      
      // Fallback: return document metadata without viewing URL
      return NextResponse.json({
        document: {
          id: document.id,
          file_name: document.file_name,
          file_size: document.file_size,
          mime_type: document.mime_type,
          document_type: document.document_type,
          verification_status: document.verification_status,
          uploaded_at: document.uploaded_at
        },
        viewUrl: null,
        message: 'Document metadata available but viewing temporarily unavailable'
      })
    }

  } catch (error) {
    console.error('Error fetching document:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}