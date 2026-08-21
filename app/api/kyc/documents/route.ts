import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sanitizeInput } from '@/lib/security'

const KYC_BUCKET = 'kyc-documents'
const VALID_DOCUMENT_TYPES = [
  'identity',
  'business_license',
  'tax_document',
  'address_proof',
  'bank_statement',
] as const
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const
const MAX_FILE_SIZE = 10 * 1024 * 1024

type DocumentType = (typeof VALID_DOCUMENT_TYPES)[number]
type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number]

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

function splitStoragePath(filePath: string) {
  const slash = filePath.lastIndexOf('/')
  if (slash <= 0 || slash === filePath.length - 1) return null
  return {
    folder: filePath.slice(0, slash),
    name: filePath.slice(slash + 1),
  }
}

function storageMetadata(value: unknown): { size: number | null; mimeType: string | null } {
  const metadata =
    value && typeof value === 'object' && 'metadata' in value
      ? (value as { metadata?: unknown }).metadata
      : null

  if (!metadata || typeof metadata !== 'object') {
    return { size: null, mimeType: null }
  }

  const raw = metadata as Record<string, unknown>
  const sizeValue = raw.size
  const size =
    typeof sizeValue === 'number'
      ? sizeValue
      : typeof sizeValue === 'string' && /^\d+$/.test(sizeValue)
        ? Number(sizeValue)
        : null
  const mimeValue = raw.mimetype ?? raw.mime_type ?? raw.contentType
  const mimeType = typeof mimeValue === 'string' ? mimeValue.toLowerCase() : null
  return { size, mimeType }
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
      // Legacy client hints are accepted in the request shape for compatibility
      // but are never trusted as the stored source of truth.
      fileSize?: number
      mimeType?: string
    }

    const documentType = sanitizeInput(body.documentType ?? '') as DocumentType
    const fileName = sanitizeInput(body.fileName ?? '')
    const filePath = body.filePath || (body.uploadURL ? pathFromSignedUploadUrl(body.uploadURL) : null)

    if (!VALID_DOCUMENT_TYPES.includes(documentType)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 })
    }

    if (!fileName || !filePath) {
      return NextResponse.json(
        { error: 'Document type, file path, and file name are required' },
        { status: 400 },
      )
    }

    const requiredPrefix = `${user.id}/${documentType}/`
    if (!filePath.startsWith(requiredPrefix) || filePath.includes('..') || filePath.includes('\\')) {
      return NextResponse.json({ error: 'Invalid KYC storage path' }, { status: 400 })
    }

    const location = splitStoragePath(filePath)
    if (!location) {
      return NextResponse.json({ error: 'Invalid KYC storage path' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()

    // Do not let a client register an arbitrary path or lie about upload
    // metadata. The object must already exist inside this seller's private KYC
    // prefix. Bucket-level restrictions are the primary size/MIME enforcement;
    // the observed object metadata is checked again here before DB registration.
    const { data: objects, error: listError } = await admin.storage
      .from(KYC_BUCKET)
      .list(location.folder, {
        limit: 100,
        search: location.name,
      })

    if (listError) {
      console.error('Unable to verify KYC storage object:', listError)
      return NextResponse.json({ error: 'Unable to verify secure upload' }, { status: 503 })
    }

    const storageObject = objects?.find((entry) => entry.name === location.name)
    if (!storageObject) {
      return NextResponse.json(
        { error: 'Uploaded KYC object was not found; upload must complete before registration' },
        { status: 409 },
      )
    }

    const observed = storageMetadata(storageObject)
    if (observed.size != null && (observed.size <= 0 || observed.size > MAX_FILE_SIZE)) {
      await admin.storage.from(KYC_BUCKET).remove([filePath]).catch(() => undefined)
      return NextResponse.json({ error: 'Uploaded file exceeds the 10MB limit' }, { status: 400 })
    }

    if (
      observed.mimeType &&
      !ALLOWED_MIME_TYPES.includes(observed.mimeType as AllowedMime)
    ) {
      await admin.storage.from(KYC_BUCKET).remove([filePath]).catch(() => undefined)
      return NextResponse.json({ error: 'Unsupported KYC document type' }, { status: 400 })
    }

    const { data: existing } = await admin
      .from('kyc_documents')
      .select('id')
      .eq('seller_id', user.id)
      .eq('file_path', filePath)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'This KYC upload is already registered', documentId: existing.id },
        { status: 409 },
      )
    }

    const { data: document, error: insertError } = await admin
      .from('kyc_documents')
      .insert({
        seller_id: user.id,
        document_type: documentType,
        file_path: filePath,
        file_name: fileName,
        file_size: observed.size,
        mime_type: observed.mimeType,
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
