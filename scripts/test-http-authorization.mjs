import assert from 'node:assert/strict'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const origin = process.env.APP_ORIGIN || 'http://127.0.0.1:3000'
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error('SUPABASE_URL, SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required')
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const createdUserIds = []
const password = 'HttpRegression-Only-2026!'
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`

function cookieHeader(cookieJar) {
  return [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
}

async function createUser(label, appMetadata = {}) {
  const email = `http-${label}-${runId}@example.test`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: appMetadata,
  })
  if (error || !data.user) throw error || new Error(`Unable to create ${label}`)
  createdUserIds.push(data.user.id)

  const cookieJar = new Map()
  const authClient = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      get(name) {
        return cookieJar.get(name)
      },
      set(name, value) {
        cookieJar.set(name, value)
      },
      remove(name) {
        cookieJar.delete(name)
      },
    },
  })
  const { error: signInError } = await authClient.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError

  return { id: data.user.id, email, cookie: cookieHeader(cookieJar) }
}

async function appFetch(path, { cookie, method = 'GET', json, body, headers = {} } = {}) {
  const requestHeaders = new Headers(headers)
  if (cookie) requestHeaders.set('cookie', cookie)
  if (json !== undefined) requestHeaders.set('content-type', 'application/json')

  return fetch(`${origin}${path}`, {
    method,
    headers: requestHeaders,
    body: json !== undefined ? JSON.stringify(json) : body,
    redirect: 'manual',
  })
}

async function expectStatus(label, response, expected) {
  const payload = await response.clone().text().catch(() => '')
  assert.equal(
    response.status,
    expected,
    `${label}: expected HTTP ${expected}, received ${response.status}; body=${payload.slice(0, 800)}`,
  )
  process.stdout.write(`ok - ${label} -> ${expected}\n`)
  return payload ? JSON.parse(payload) : null
}

async function uploadSignedBytes(uploadURL, bytes, contentType) {
  const response = await fetch(uploadURL, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: bytes,
  })
  const body = await response.clone().text().catch(() => '')
  assert.ok(response.ok, `signed quarantine upload failed: HTTP ${response.status}; body=${body.slice(0, 500)}`)
}

async function assertScanJob(uploadId, expectedStatus, expectedBucket) {
  const { data, error } = await admin
    .from('upload_scan_jobs')
    .select('id, actor_id, purpose, quarantine_path, destination_bucket, destination_path, status, verified_mime, byte_size, sha256, scanner, scanner_result_code, scanned_at, promoted_at')
    .eq('id', uploadId)
    .single()
  if (error) throw error
  assert.equal(data.status, expectedStatus)
  if (expectedBucket) assert.equal(data.destination_bucket, expectedBucket)
  return data
}

function productPayload() {
  return {
    title: 'HTTP ownership regression product',
    description: 'Created only inside the local CI authorization regression suite.',
    shortDescription: 'CI-only product',
    productType: 'physical',
    basePrice: 25,
    compareAtPrice: null,
    costPerItem: null,
    brandId: null,
    categoryIds: [],
    mediaUrls: [],
    variants: [
      {
        title: 'Default',
        option1: '',
        option2: '',
        option3: '',
        sku: `HTTP-${runId}`.slice(0, 100),
        barcode: '',
        price: 25,
        compareAtPrice: null,
        costPerItem: null,
        trackInventory: true,
        inventoryQuantity: 5,
        inventoryPolicy: 'deny',
        weightGrams: 100,
        requiresShipping: true,
        isActive: true,
      },
    ],
    trackInventory: true,
    continueSelling: false,
    requiresShipping: true,
    isTaxable: true,
    weightGrams: 100,
    material: '',
    ageRestriction: 18,
    tags: ['ci-regression'],
    searchKeywords: ['ci-regression'],
  }
}

function brandingForm(bytes, name = 'logo.png', type = 'image/png') {
  const form = new FormData()
  form.set('slot', 'logo')
  form.set('file', new File([bytes], name, { type }))
  return form
}

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=',
  'base64',
)
const eicarPdf = Buffer.concat([
  Buffer.from('%PDF-1.4\n', 'ascii'),
  Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*', 'ascii'),
  Buffer.from('\n%%EOF\n', 'ascii'),
])

try {
  const buyer = await createUser('buyer')
  const sellerA = await createUser('seller-a')
  const sellerB = await createUser('seller-b')
  const adminUser = await createUser('admin', { role: 'admin' })

  await expectStatus('anonymous capability lookup denied', await appFetch('/api/auth/capabilities'), 401)
  await expectStatus(
    'buyer onboarding is self-scoped',
    await appFetch('/api/onboarding/buyer', {
      cookie: buyer.cookie,
      method: 'POST',
      json: { display_name: 'HTTP Buyer', id: sellerA.id },
    }),
    200,
  )
  await expectStatus(
    'seller A onboarding',
    await appFetch('/api/onboarding/seller', {
      cookie: sellerA.cookie,
      method: 'POST',
      json: { storefront_name: 'HTTP Seller A', business_type: 'individual' },
    }),
    200,
  )
  await expectStatus(
    'seller B onboarding',
    await appFetch('/api/onboarding/seller', {
      cookie: sellerB.cookie,
      method: 'POST',
      json: { storefront_name: 'HTTP Seller B', business_type: 'individual' },
    }),
    200,
  )

  await expectStatus(
    'buyer self-profile update',
    await appFetch('/api/buyer/profile', {
      cookie: buyer.cookie,
      method: 'PATCH',
      json: { display_name: 'HTTP Buyer Updated', country: 'PH', interests: ['marketplace'] },
    }),
    200,
  )
  await expectStatus(
    'anonymous buyer profile update denied',
    await appFetch('/api/buyer/profile', { method: 'PATCH', json: { display_name: 'Nope' } }),
    401,
  )

  const { data: sellerAInitial, error: sellerAInitialError } = await admin
    .from('profiles_seller')
    .select('store_slug, storefront_name, logo_url')
    .eq('id', sellerA.id)
    .single()
  if (sellerAInitialError) throw sellerAInitialError

  await expectStatus(
    'anonymous storefront mutation denied',
    await appFetch('/api/seller/storefront', {
      method: 'PATCH',
      json: { storefrontName: 'Anonymous Store' },
    }),
    401,
  )
  await expectStatus(
    'buyer cannot mutate Seller storefront',
    await appFetch('/api/seller/storefront', {
      cookie: buyer.cookie,
      method: 'PATCH',
      json: { storefrontName: 'Buyer Store' },
    }),
    403,
  )
  const storefrontUpdate = await expectStatus(
    'seller storefront update is authenticated-self scoped',
    await appFetch('/api/seller/storefront', {
      cookie: sellerA.cookie,
      method: 'PATCH',
      json: {
        storefrontName: 'HTTP Seller A Updated',
        bio: 'Seller A only',
        shippingPolicy: 'Ships safely.',
        returnPolicy: 'Returns safely.',
        storeSlug: 'attempted-slug-overwrite',
        id: sellerB.id,
      },
    }),
    200,
  )
  assert.equal(storefrontUpdate.storefront.store_slug, sellerAInitial.store_slug)
  const { data: sellerProfilesAfterStorefront, error: storefrontVerificationError } = await admin
    .from('profiles_seller')
    .select('id, storefront_name, store_slug')
    .in('id', [sellerA.id, sellerB.id])
  if (storefrontVerificationError) throw storefrontVerificationError
  const sellerAAfterStorefront = sellerProfilesAfterStorefront.find((row) => row.id === sellerA.id)
  const sellerBAfterStorefront = sellerProfilesAfterStorefront.find((row) => row.id === sellerB.id)
  assert.equal(sellerAAfterStorefront.storefront_name, 'HTTP Seller A Updated')
  assert.equal(sellerAAfterStorefront.store_slug, sellerAInitial.store_slug)
  assert.equal(sellerBAfterStorefront.storefront_name, 'HTTP Seller B')

  await expectStatus(
    'buyer cannot create Seller product',
    await appFetch('/api/seller/products', {
      cookie: buyer.cookie,
      method: 'POST',
      json: productPayload(),
    }),
    403,
  )
  const createdProduct = await expectStatus(
    'seller A can create owned product',
    await appFetch('/api/seller/products', {
      cookie: sellerA.cookie,
      method: 'POST',
      json: productPayload(),
    }),
    201,
  )
  assert.match(createdProduct.id, /^[0-9a-f-]{36}$/i)
  await expectStatus(
    'seller B cannot delete seller A product',
    await appFetch(`/api/seller/products/${createdProduct.id}`, {
      cookie: sellerB.cookie,
      method: 'DELETE',
    }),
    404,
  )

  await expectStatus(
    'anonymous KYC upload initialization denied',
    await appFetch('/api/kyc/upload', {
      method: 'POST',
      json: { documentType: 'identity', fileName: 'id.png', fileSize: onePixelPng.length, mimeType: 'image/png' },
    }),
    401,
  )
  await expectStatus(
    'buyer cannot initialize Seller KYC upload',
    await appFetch('/api/kyc/upload', {
      cookie: buyer.cookie,
      method: 'POST',
      json: { documentType: 'identity', fileName: 'id.png', fileSize: onePixelPng.length, mimeType: 'image/png' },
    }),
    403,
  )
  const kycUpload = await expectStatus(
    'seller can initialize private KYC quarantine upload',
    await appFetch('/api/kyc/upload', {
      cookie: sellerA.cookie,
      method: 'POST',
      json: { documentType: 'identity', fileName: 'id.png', fileSize: onePixelPng.length, mimeType: 'image/png' },
    }),
    200,
  )
  assert.equal(kycUpload.bucket, 'upload-quarantine')
  assert.match(kycUpload.uploadId, /^[0-9a-f-]{36}$/i)
  assert.equal(typeof kycUpload.uploadURL, 'string')
  assert.equal('filePath' in kycUpload, false)
  await uploadSignedBytes(kycUpload.uploadURL, onePixelPng, 'image/png')
  await expectStatus(
    'seller B cannot finalize seller A KYC quarantine job',
    await appFetch('/api/kyc/upload', {
      cookie: sellerB.cookie,
      method: 'PUT',
      json: { uploadId: kycUpload.uploadId },
    }),
    404,
  )
  const finalizedKyc = await expectStatus(
    'seller A can scan and promote owned KYC document',
    await appFetch('/api/kyc/upload', {
      cookie: sellerA.cookie,
      method: 'PUT',
      json: { uploadId: kycUpload.uploadId },
    }),
    200,
  )
  assert.equal(finalizedKyc.filePath.startsWith(`${sellerA.id}/identity/`), true)
  const cleanKycJob = await assertScanJob(kycUpload.uploadId, 'clean', 'kyc-documents')
  assert.equal(cleanKycJob.actor_id, sellerA.id)
  assert.equal(cleanKycJob.verified_mime, 'image/png')
  assert.match(cleanKycJob.sha256, /^[0-9a-f]{64}$/)
  assert.equal(cleanKycJob.scanner, 'deterministic-ci')
  assert.ok(cleanKycJob.scanned_at)
  assert.ok(cleanKycJob.promoted_at)
  await expectStatus(
    'another seller cannot register seller A promoted KYC path',
    await appFetch('/api/kyc/documents', {
      cookie: sellerB.cookie,
      method: 'POST',
      json: { documentType: 'identity', fileName: 'stolen.png', filePath: finalizedKyc.filePath },
    }),
    400,
  )
  await expectStatus(
    'seller can discard an unregistered clean KYC promotion',
    await appFetch('/api/kyc/upload', {
      cookie: sellerA.cookie,
      method: 'DELETE',
      json: { uploadId: kycUpload.uploadId },
    }),
    200,
  )

  const infectedKycUpload = await expectStatus(
    'seller can initialize malware-regression KYC quarantine upload',
    await appFetch('/api/kyc/upload', {
      cookie: sellerA.cookie,
      method: 'POST',
      json: { documentType: 'address_proof', fileName: 'eicar.pdf', fileSize: eicarPdf.length, mimeType: 'application/pdf' },
    }),
    200,
  )
  await uploadSignedBytes(infectedKycUpload.uploadURL, eicarPdf, 'application/pdf')
  const infectedFinalize = await expectStatus(
    'EICAR KYC fixture is blocked before promotion',
    await appFetch('/api/kyc/upload', {
      cookie: sellerA.cookie,
      method: 'PUT',
      json: { uploadId: infectedKycUpload.uploadId },
    }),
    400,
  )
  assert.equal(infectedFinalize.code, 'eicar_test_signature')
  const blockedKycJob = await assertScanJob(infectedKycUpload.uploadId, 'blocked', 'kyc-documents')
  assert.equal(blockedKycJob.scanner_result_code, 'eicar_test_signature')
  const blockedDestination = await admin.storage.from('kyc-documents').download(blockedKycJob.destination_path)
  assert.ok(blockedDestination.error, 'blocked KYC object unexpectedly reached destination storage')

  await expectStatus(
    'buyer cannot initialize product-media upload',
    await appFetch('/api/seller/product-media/upload', {
      cookie: buyer.cookie,
      method: 'POST',
      json: { fileName: 'product.png', fileSize: onePixelPng.length, mimeType: 'image/png' },
    }),
    403,
  )
  const productMediaUpload = await expectStatus(
    'seller can initialize owned product-media quarantine upload',
    await appFetch('/api/seller/product-media/upload', {
      cookie: sellerA.cookie,
      method: 'POST',
      json: { fileName: 'product.png', fileSize: onePixelPng.length, mimeType: 'image/png' },
    }),
    200,
  )
  assert.equal(productMediaUpload.bucket, 'upload-quarantine')
  assert.match(productMediaUpload.uploadId, /^[0-9a-f-]{36}$/i)
  assert.equal('publicUrl' in productMediaUpload, false)
  assert.equal('filePath' in productMediaUpload, false)
  await uploadSignedBytes(productMediaUpload.uploadURL, onePixelPng, 'image/png')
  await expectStatus(
    'seller B cannot finalize seller A product-media quarantine job',
    await appFetch('/api/seller/product-media/upload', {
      cookie: sellerB.cookie,
      method: 'PUT',
      json: { uploadId: productMediaUpload.uploadId },
    }),
    404,
  )
  const productMediaFinal = await expectStatus(
    'seller scans before product-media public promotion',
    await appFetch('/api/seller/product-media/upload', {
      cookie: sellerA.cookie,
      method: 'PUT',
      json: { uploadId: productMediaUpload.uploadId },
    }),
    200,
  )
  assert.equal(productMediaFinal.filePath.startsWith(`${sellerA.id}/`), true)
  assert.equal(typeof productMediaFinal.publicUrl, 'string')
  const mediaJob = await assertScanJob(productMediaUpload.uploadId, 'clean', 'product-media')
  assert.equal(mediaJob.scanner, 'deterministic-ci')
  assert.match(mediaJob.sha256, /^[0-9a-f]{64}$/)
  const publicMediaResponse = await fetch(productMediaFinal.publicUrl)
  assert.equal(publicMediaResponse.status, 200, 'clean product media was not publicly reachable after promotion')
  await expectStatus(
    'seller B cannot delete seller A promoted product-media path',
    await appFetch('/api/seller/product-media/upload', {
      cookie: sellerB.cookie,
      method: 'DELETE',
      json: { filePath: productMediaFinal.filePath },
    }),
    400,
  )

  const spoofBytes = Buffer.from('not-a-real-image')
  const spoofUpload = await expectStatus(
    'seller can initialize spoof-regression product-media quarantine upload',
    await appFetch('/api/seller/product-media/upload', {
      cookie: sellerA.cookie,
      method: 'POST',
      json: { fileName: 'spoof.png', fileSize: spoofBytes.length, mimeType: 'image/png' },
    }),
    200,
  )
  await uploadSignedBytes(spoofUpload.uploadURL, spoofBytes, 'image/png')
  const spoofFinalize = await expectStatus(
    'spoofed product image is rejected before public promotion',
    await appFetch('/api/seller/product-media/upload', {
      cookie: sellerA.cookie,
      method: 'PUT',
      json: { uploadId: spoofUpload.uploadId },
    }),
    400,
  )
  assert.equal(spoofFinalize.code, 'magic_bytes_or_mime_mismatch')
  const spoofJob = await assertScanJob(spoofUpload.uploadId, 'blocked', 'product-media')
  const spoofDestination = await admin.storage.from('product-media').download(spoofJob.destination_path)
  assert.ok(spoofDestination.error, 'spoofed product image unexpectedly reached public storage')

  await expectStatus(
    'anonymous branding upload denied',
    await appFetch('/api/seller/branding', {
      method: 'POST',
      body: brandingForm(onePixelPng),
    }),
    401,
  )
  await expectStatus(
    'buyer cannot upload Seller branding',
    await appFetch('/api/seller/branding', {
      cookie: buyer.cookie,
      method: 'POST',
      body: brandingForm(onePixelPng),
    }),
    403,
  )
  await expectStatus(
    'seller branding rejects spoofed image bytes',
    await appFetch('/api/seller/branding', {
      cookie: sellerA.cookie,
      method: 'POST',
      body: brandingForm(Buffer.from('not-a-real-image'), 'spoofed.png'),
    }),
    400,
  )
  const brandingUpload = await expectStatus(
    'seller can upload scanned owned branding',
    await appFetch('/api/seller/branding', {
      cookie: sellerA.cookie,
      method: 'POST',
      body: brandingForm(onePixelPng),
    }),
    200,
  )
  assert.equal(brandingUpload.slot, 'logo')
  assert.equal(brandingUpload.url.includes(`/seller-branding/${sellerA.id}/logo/`), true)
  const { data: sellerProfilesAfterBranding, error: brandingVerificationError } = await admin
    .from('profiles_seller')
    .select('id, logo_url')
    .in('id', [sellerA.id, sellerB.id])
  if (brandingVerificationError) throw brandingVerificationError
  const sellerAAfterBranding = sellerProfilesAfterBranding.find((row) => row.id === sellerA.id)
  const sellerBAfterBranding = sellerProfilesAfterBranding.find((row) => row.id === sellerB.id)
  assert.equal(sellerAAfterBranding.logo_url, brandingUpload.url)
  assert.equal(sellerBAfterBranding.logo_url, null)

  const sent = await expectStatus(
    'buyer can send encrypted message',
    await appFetch('/api/messages/send', {
      cookie: buyer.cookie,
      method: 'POST',
      json: { recipientId: sellerA.id, content: 'HTTP authorization regression message', messageType: 'text' },
    }),
    200,
  )
  const messageId = sent.message.id

  const recipientAttempt = new FormData()
  recipientAttempt.set('messageId', messageId)
  recipientAttempt.set('file', new File([onePixelPng], 'recipient.png', { type: 'image/png' }))
  await expectStatus(
    'message recipient cannot attach to sender-owned message',
    await appFetch('/api/messages/attachments/upload', {
      cookie: sellerA.cookie,
      method: 'POST',
      body: recipientAttempt,
    }),
    403,
  )

  const senderUpload = new FormData()
  senderUpload.set('messageId', messageId)
  senderUpload.set('file', new File([onePixelPng], 'sender.png', { type: 'image/png' }))
  const attachmentResult = await expectStatus(
    'message sender can attach scanned media',
    await appFetch('/api/messages/attachments/upload', {
      cookie: buyer.cookie,
      method: 'POST',
      body: senderUpload,
    }),
    201,
  )
  const attachmentId = attachmentResult.attachment.id

  await expectStatus(
    'unrelated seller cannot download message attachment',
    await appFetch(`/api/messages/attachments/download?id=${encodeURIComponent(attachmentId)}`, {
      cookie: sellerB.cookie,
    }),
    403,
  )
  await expectStatus(
    'conversation recipient can receive signed attachment URL',
    await appFetch(`/api/messages/attachments/download?id=${encodeURIComponent(attachmentId)}`, {
      cookie: sellerA.cookie,
    }),
    200,
  )

  await expectStatus('anonymous Admin account search denied', await appFetch('/api/admin/accounts'), 401)
  await expectStatus(
    'ordinary buyer cannot use Admin account search',
    await appFetch('/api/admin/accounts', { cookie: buyer.cookie }),
    403,
  )
  await expectStatus(
    'trusted app-metadata Admin can use Admin account search',
    await appFetch('/api/admin/accounts?perPage=5', { cookie: adminUser.cookie }),
    200,
  )

  await expectStatus(
    'unsigned EntizNet Admin integration is fail-closed',
    await appFetch('/api/integrations/entiznet/admin/health'),
    401,
  )

  await expectStatus(
    'seller A can delete own promoted product media',
    await appFetch('/api/seller/product-media/upload', {
      cookie: sellerA.cookie,
      method: 'DELETE',
      json: { filePath: productMediaFinal.filePath },
    }),
    200,
  )

  await expectStatus(
    'seller A can delete own product',
    await appFetch(`/api/seller/products/${createdProduct.id}`, {
      cookie: sellerA.cookie,
      method: 'DELETE',
    }),
    200,
  )

  process.stdout.write('HTTP authorization regression suite passed\n')
} finally {
  if (createdUserIds.length) {
    const { data: jobs, error: jobError } = await admin
      .from('upload_scan_jobs')
      .select('quarantine_path, destination_bucket, destination_path')
      .in('actor_id', createdUserIds)
    if (!jobError && jobs?.length) {
      const quarantinePaths = jobs.map((job) => job.quarantine_path).filter(Boolean)
      if (quarantinePaths.length) {
        const { error } = await admin.storage.from('upload-quarantine').remove(quarantinePaths)
        if (error) process.stderr.write(`warning: unable to clean quarantine test objects: ${error.message}\n`)
      }
      for (const bucket of ['kyc-documents', 'message-attachments', 'product-media', 'seller-branding']) {
        const paths = jobs
          .filter((job) => job.destination_bucket === bucket)
          .map((job) => job.destination_path)
          .filter(Boolean)
        if (!paths.length) continue
        const { error } = await admin.storage.from(bucket).remove(paths)
        if (error) process.stderr.write(`warning: unable to clean ${bucket} test objects: ${error.message}\n`)
      }
    }
  }

  for (const userId of createdUserIds.reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) process.stderr.write(`warning: unable to delete CI auth user ${userId}: ${error.message}\n`)
  }
}
