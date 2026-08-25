import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { reportOperationalError } from '@/lib/observability/operationalEventSink'
import { createServerSupabase } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const KYC_BUCKET = 'kyc-documents'
const VALID_DOCUMENT_TYPES = [
  'identity',
  'business_license',
  'tax_document',
  'address_proof',
  'bank_statement',
] as const

type DocumentType = (typeof VALID_DOCUMENT_TYPES)[number]

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
      fileName?: string
    }
    const documentType = body.documentType as DocumentType | undefined

    if (!documentType || !VALID_DOCUMENT_TYPES.includes(documentType)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 })
    }

    const extension = body.fileName?.match(/\.[a-z0-9]{1,10}$/i)?.[0]?.toLowerCase() ?? ''
    const filePath = `${user.id}/${documentType}/${randomUUID()}${extension}`

    const { data, error } = await getSupabaseAdmin()
      .storage
      .from(KYC_BUCKET)
      .createSignedUploadUrl(filePath)

    if (error || !data?.signedUrl) {
      await reportOperationalError(
        'storage.kyc.signed_upload_init_failed',
        error ?? 'signed upload URL was not returned',
        {
          component: 'storage',
          operation: 'create-signed-upload-url',
          bucket: KYC_BUCKET,
          route: '/api/kyc/upload',
          actorId: user.id,
        },
      )
      return NextResponse.json({ error: 'Unable to initialize secure upload' }, { status: 500 })
    }

    return NextResponse.json({
      uploadURL: data.signedUrl,
      token: data.token,
      filePath,
      bucket: KYC_BUCKET,
      method: 'PUT',
    })
  } catch (error) {
    await reportOperationalError('storage.kyc.upload_route_failed', error, {
      component: 'storage',
      operation: 'initialize-kyc-upload',
      bucket: KYC_BUCKET,
      route: '/api/kyc/upload',
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
