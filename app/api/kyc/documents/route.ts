import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sanitizeInput } from '@/lib/security'

const KYC_BUCKET = 'kyc-documents'
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const
const MAX_FILE_SIZE = 10 * 1024 * 1024

function pathFromSignedUploadUrl(value: string): string | null {
  try {
    const marker = `/object/upload/sign/${KYC_BUCKET}/`
    const pathname = new URL(value).pathname
    const index = pathname.indexOf(marker)
    if (index < 0) return null
    return decodeURIComponent(pathname.slice(index + marker.length))
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: sellerProfile } = await supabase
      .from('profiles_seller')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!sellerProfile) {
      return NextResponse.json({ error: 'Seller capability required' }, { status: 403 })
    }

    const body = (await request.json()) as {
      documentType?: string
      filePath?: string
      uploadURL?: string
      fileName?: string
      fileSize?: number
      mimeType?: string
    }

    const documentType = sanitizeInput(body.documentType ?? '')
    const fileName = sanitizeInput(body.fileName ?? '')
    const filePath = body.filePath || (body.uploadURL ? pathFromSignedUploadUrl(body.uploadURL) : null)

    if (!documentType || !fileName || !filePath) {
      return NextResponse.json(
        { error: 'Document type, file path, and file name are required' },
        { status: 400 },
      )
    }

    if (body.fileSize != null && (body.fileSize < 0 || body.fileSize > MAX_FILE_SIZE)) {
      return NextResponse.json({ error: 'File size exceeds the 10MB limit' }, { status: 400 })
    }

    if (
      body.mimeType &&
      !ALLOWED_MIME_TYPES.includes(body.mimeType as (typeof ALLOWED_MIME_TYPES)[number])
    ) {
      return NextResponse.json({ error: 'Unsupported KYC document type' }, { status: 400 })
    }

    const requiredPrefix = `${user.id}/${documentType}/`
    if (!filePath.startsWith(requiredPrefix) || filePath.includes('..')) {
      return NextResponse.json({ error: 'Invalid KYC storage path' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    const { data: document, error: insertError } = await admin
      .from('kyc_documents')
      .insert({
        seller_id: user.id,
        document_type: documentType,
        file_path: filePath,
        file_name: fileName,
        file_size: body.fileSize ?? null,
        mime_type: body.mimeType ?? null,
        verification_status: 'pending',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating KYC document record:', insertError)
      return NextResponse.json({ error: 'Failed to save document record' }, { status: 500 })
    }

    const { data: verificationRequest } = await admin
      .from('kyc_verification_requests')
      .select('id, required_documents, submitted_documents')
      .eq('seller_id', user.id)
      .maybeSingle()

    if (verificationRequest) {
      const submitted = Array.from(
        new Set([...(verificationRequest.submitted_documents ?? []), documentType]),
      )
      const required = verificationRequest.required_documents ?? []
      const isComplete = required.every((item: string) => submitted.includes(item))

      const { error: updateError } = await admin
        .from('kyc_verification_requests')
        .update({
          submitted_documents: submitted,
          verification_status: isComplete ? 'under_review' : 'incomplete',
        })
        .eq('id', verificationRequest.id)

      if (updateError) {
        console.error('Error updating KYC verification request:', updateError)
      }
    }

    return NextResponse.json({ success: true, document }, { status: 201 })
  } catch (error) {
    console.error('Error saving KYC document:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
