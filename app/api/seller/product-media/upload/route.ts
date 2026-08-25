import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { reportOperationalError } from '@/lib/observability/operationalEventSink'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  PRODUCT_MEDIA_BUCKET,
  PRODUCT_MEDIA_MAX_FILE_SIZE,
  PRODUCT_MEDIA_MIME_TYPES,
  productMediaPathFromPublicUrl,
  type ProductMediaMime,
} from '@/lib/storage/productMedia'

function extensionForMime(mimeType: ProductMediaMime) {
  switch (mimeType) {
    case 'image/png':
      return '.png'
    case 'image/webp':
      return '.webp'
    case 'image/jpeg':
    case 'image/jpg':
    default:
      return '.jpg'
  }
}

async function requireSeller() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return { user: null, status: 401 as const }

  const { data: seller } = await supabase
    .from('profiles_seller')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (!seller) return { user: null, status: 403 as const }
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

    const filePath = `${auth.user.id}/${randomUUID()}${extensionForMime(mimeType)}`
    const admin = getSupabaseAdmin()
    const { data, error } = await admin.storage
      .from(PRODUCT_MEDIA_BUCKET)
      .createSignedUploadUrl(filePath)

    if (error || !data?.signedUrl) {
      await reportOperationalError(
        'storage.product_media.signed_upload_init_failed',
        error ?? 'signed upload URL was not returned',
        {
          component: 'storage',
          operation: 'create-signed-upload-url',
          bucket: PRODUCT_MEDIA_BUCKET,
          route: '/api/seller/product-media/upload',
          actorId: auth.user.id,
        },
      )
      return NextResponse.json({ error: 'Unable to initialize secure upload' }, { status: 500 })
    }

    const { data: publicData } = admin.storage.from(PRODUCT_MEDIA_BUCKET).getPublicUrl(filePath)

    return NextResponse.json({
      uploadURL: data.signedUrl,
      token: data.token,
      filePath,
      publicUrl: publicData.publicUrl,
      bucket: PRODUCT_MEDIA_BUCKET,
      method: 'PUT',
    })
  } catch (error) {
    await reportOperationalError('storage.product_media.upload_route_failed', error, {
      component: 'storage',
      operation: 'initialize-product-media-upload',
      bucket: PRODUCT_MEDIA_BUCKET,
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

    const body = (await request.json()) as { filePath?: string; publicUrl?: string }
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
