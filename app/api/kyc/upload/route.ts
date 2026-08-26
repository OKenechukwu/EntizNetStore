import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { reportOperationalError } from '@/lib/observability/operationalEventSink'
import { createServerSupabase } from '@/lib/supabase/server'
import { abandonQuarantinedUpload } from '@/lib/storage/abandonQuarantine'
import {
  extensionForUploadMime,
  finalizeQuarantinedUpload,
  initializeSignedQuarantineUpload,
} from '@/lib/storage/quarantine'

const KYC_BUCKET = 'kyc-documents'
const MAX_FILE_SIZE = 10 * 1024 * 1024
const VALID_DOCUMENT_TYPES = [
  'identity',
  'business_license',
  'tax_document',
  'address_proof',
  'bank_statement',
] as const
const VALID_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

type DocumentType = (typeof VALID_DOCUMENT_TYPES)[number]

async function requireSeller() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return { user: null, status: 401 as const }

  const { data: sellers } = await supabase
    .from('profiles_seller')
    .select('id')
    .eq('id', user.id)
    .limit(1)
  if (!sellers?.length) return { user: null, status: 403 as const }

  return { user, status: 200 as const }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSeller()
    if (!auth.user) {
      return NextResponse.json(
        { error: auth.status === 401 ? 'Unauthorized' : 'Seller capability required' },
        { status: auth.status },
      )
    }

    const body = (await request.json()) as {
      documentType?: string
      fileName?: string
      fileSize?: number
      mimeType?: string
    }
    const documentType = body.documentType as DocumentType | undefined
    const mimeType = body.mimeType?.trim().toLowerCase() || ''
    const fileSize = Number(body.fileSize)

    if (!documentType || !VALID_DOCUMENT_TYPES.includes(documentType)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 })
    }
    if (!VALID_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: 'KYC documents must be PDF, JPEG, PNG, or WebP' },
        { status: 400 },
      )
    }
    if (!Number.isInteger(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'KYC documents must be 10MB or smaller' }, { status: 400 })
    }

    const destinationPath = `${auth.user.id}/${documentType}/${randomUUID()}${extensionForUploadMime(mimeType)}`
    const initialized = await initializeSignedQuarantineUpload({
      actorId: auth.user.id,
      purpose: 'kyc',
      destinationBucket: KYC_BUCKET,
      destinationPath,
      fileSize,
      mimeType,
      maxBytes: MAX_FILE_SIZE,
    })

    return NextResponse.json({
      ...initialized,
      bucket: 'upload-quarantine',
    })
  } catch (error) {
    await reportOperationalError('storage.kyc.upload_route_failed', error, {
      component: 'storage',
      operation: 'initialize-kyc-quarantine',
      bucket: 'upload-quarantine',
      route: '/api/kyc/upload',
    })
    return NextResponse.json({ error: 'Unable to initialize secure upload' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireSeller()
    if (!auth.user) {
      return NextResponse.json(
        { error: auth.status === 401 ? 'Unauthorized' : 'Seller capability required' },
        { status: auth.status },
      )
    }

    const body = (await request.json()) as { uploadId?: string }
    if (!body.uploadId) {
      return NextResponse.json({ error: 'Upload ID is required' }, { status: 400 })
    }

    const finalized = await finalizeQuarantinedUpload({
      uploadId: body.uploadId,
      actorId: auth.user.id,
      maxBytes: MAX_FILE_SIZE,
    })

    if (!finalized.ok) {
      const status = finalized.kind === 'scanner_unavailable'
        ? 503
        : finalized.kind === 'blocked' || finalized.kind === 'invalid_file'
          ? 400
          : finalized.kind === 'not_found'
            ? 404
            : finalized.kind === 'invalid_state'
              ? 409
              : 500
      if (status >= 500) {
        await reportOperationalError('storage.kyc.scan_or_promotion_failed', finalized.code, {
          component: 'storage',
          operation: 'scan-and-promote-kyc',
          bucket: 'upload-quarantine',
          route: '/api/kyc/upload',
          actorId: auth.user.id,
          recordId: body.uploadId,
        })
      }
      return NextResponse.json(
        {
          error: finalized.kind === 'scanner_unavailable'
            ? 'Upload safety scanner is unavailable. The KYC document was not accepted.'
            : finalized.kind === 'blocked'
              ? 'The KYC document did not pass the safety scan.'
              : finalized.kind === 'invalid_file'
                ? 'The KYC document content does not match an allowed file format.'
                : 'Unable to finalize KYC upload safely',
          code: finalized.code,
        },
        { status },
      )
    }

    return NextResponse.json({
      uploadId: finalized.uploadId,
      filePath: finalized.destinationPath,
      mimeType: finalized.mimeType,
      fileSize: finalized.size,
    })
  } catch (error) {
    await reportOperationalError('storage.kyc.finalize_route_failed', error, {
      component: 'storage',
      operation: 'finalize-kyc-quarantine',
      bucket: 'upload-quarantine',
      route: '/api/kyc/upload',
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireSeller()
    if (!auth.user) {
      return NextResponse.json(
        { error: auth.status === 401 ? 'Unauthorized' : 'Seller capability required' },
        { status: auth.status },
      )
    }

    const body = (await request.json()) as { uploadId?: string }
    if (!body.uploadId) {
      return NextResponse.json({ error: 'Upload ID is required' }, { status: 400 })
    }

    const abandoned = await abandonQuarantinedUpload({
      uploadId: body.uploadId,
      actorId: auth.user.id,
    })
    if (!abandoned.ok) {
      const status = abandoned.code === 'not_found' ? 404 : 409
      return NextResponse.json({ error: 'Unable to abandon KYC upload', code: abandoned.code }, { status })
    }

    return NextResponse.json({ abandoned: true })
  } catch (error) {
    await reportOperationalError('storage.kyc.abandon_route_failed', error, {
      component: 'storage',
      operation: 'abandon-kyc-quarantine',
      bucket: 'upload-quarantine',
      route: '/api/kyc/upload',
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
