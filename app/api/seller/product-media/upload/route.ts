import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { reportOperationalError } from '@/lib/observability/operationalEventSink'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { abandonQuarantinedUpload } from '@/lib/storage/abandonQuarantine'
import {
  PRODUCT_MEDIA_BUCKET,
  PRODUCT_MEDIA_MAX_FILE_SIZE,
  PRODUCT_MEDIA_MIME_TYPES,
  productMediaPathFromPublicUrl,
  type ProductMediaMime,
} from '@/lib/storage/productMedia'
import {
  finalizeQuarantinedUpload,
  initializeSignedQuarantineUpload,
  extensionForUploadMime,
} from '@/lib/storage/quarantine'

async function requireSeller() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return { user: null, status: 401 as const }

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
      fileName?: string
      fileSize?: number
      mimeType?: string
    }

    const mimeType = body.mimeType?.toLowerCase() as ProductMediaMime | undefined
    const fileSize = Number(body.fileSize)

    if (!mimeType || !PRODUCT_MEDIA_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: 'Product media must be JPEG, PNG, or WebP' },
        { status: 400 },
      )
    }

    if (!Number.isInteger(fileSize) || fileSize <= 0 || fileSize > PRODUCT_MEDIA_MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Product image must be between 1 byte and 10MB' },
        { status: 400 },
      )
    }

    const destinationPath = `${auth.user.id}/${randomUUID()}${extensionForUploadMime(mimeType)}`
    const initialized = await initializeSignedQuarantineUpload({
      actorId: auth.user.id,
      purpose: 'product_media',
      destinationBucket: PRODUCT_MEDIA_BUCKET,
      destinationPath,
      fileSize,
      mimeType,
      maxBytes: PRODUCT_MEDIA_MAX_FILE_SIZE,
    })

    return NextResponse.json({
      ...initialized,
      bucket: 'upload-quarantine',
    })
  } catch (error) {
    await reportOperationalError('storage.product_media.upload_route_failed', error, {
      component: 'storage',
      operation: 'initialize-product-media-quarantine',
      bucket: 'upload-quarantine',
      route: '/api/seller/product-media/upload',
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
      maxBytes: PRODUCT_MEDIA_MAX_FILE_SIZE,
      imagesOnly: true,
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
        await reportOperationalError('storage.product_media.scan_or_promotion_failed', finalized.code, {
          component: 'storage',
          operation: 'scan-and-promote-product-media',
          bucket: 'upload-quarantine',
          route: '/api/seller/product-media/upload',
          actorId: auth.user.id,
          recordId: body.uploadId,
        })
      }
      return NextResponse.json(
        {
          error: finalized.kind === 'scanner_unavailable'
            ? 'Upload safety scanner is unavailable. The file was not published.'
            : finalized.kind === 'blocked'
              ? 'The uploaded file did not pass the safety scan.'
              : finalized.kind === 'invalid_file'
                ? 'The uploaded file content does not match an allowed image format.'
                : 'Unable to finalize product media safely',
          code: finalized.code,
        },
        { status },
      )
    }

    const publicUrl = getSupabaseAdmin()
      .storage
      .from(PRODUCT_MEDIA_BUCKET)
      .getPublicUrl(finalized.destinationPath).data.publicUrl

    return NextResponse.json({
      uploadId: finalized.uploadId,
      filePath: finalized.destinationPath,
      publicUrl,
      mimeType: finalized.mimeType,
      fileSize: finalized.size,
    })
  } catch (error) {
    await reportOperationalError('storage.product_media.finalize_route_failed', error, {
      component: 'storage',
      operation: 'finalize-product-media-upload',
      bucket: 'upload-quarantine',
      route: '/api/seller/product-media/upload',
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

    const body = (await request.json()) as {
      uploadId?: string
      filePath?: string
      publicUrl?: string
    }

    if (body.uploadId) {
      const abandoned = await abandonQuarantinedUpload({
        uploadId: body.uploadId,
        actorId: auth.user.id,
      })
      if (!abandoned.ok) {
        const status = abandoned.code === 'not_found' ? 404 : 409
        return NextResponse.json({ error: 'Unable to abandon quarantine upload', code: abandoned.code }, { status })
      }
      return NextResponse.json({ abandoned: true })
    }

    const configuredUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    let filePath = body.filePath ?? null

    if (!filePath && body.publicUrl && configuredUrl) {
      filePath = productMediaPathFromPublicUrl(body.publicUrl, configuredUrl, auth.user.id)
    }

    if (
      !filePath ||
      !filePath.startsWith(`${auth.user.id}/`) ||
      filePath.includes('..') ||
      filePath.includes('\\')
    ) {
      return NextResponse.json({ error: 'Invalid product media path' }, { status: 400 })
    }

    const { error } = await getSupabaseAdmin().storage
      .from(PRODUCT_MEDIA_BUCKET)
      .remove([filePath])

    if (error) {
      await reportOperationalError('storage.product_media.delete_failed', error, {
        component: 'storage',
        operation: 'delete-object',
        bucket: PRODUCT_MEDIA_BUCKET,
        route: '/api/seller/product-media/upload',
        actorId: auth.user.id,
      })
      return NextResponse.json({ error: 'Unable to remove product media' }, { status: 500 })
    }

    return NextResponse.json({ deleted: true })
  } catch (error) {
    await reportOperationalError('storage.product_media.delete_route_failed', error, {
      component: 'storage',
      operation: 'delete-product-media',
      bucket: PRODUCT_MEDIA_BUCKET,
      route: '/api/seller/product-media/upload',
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
