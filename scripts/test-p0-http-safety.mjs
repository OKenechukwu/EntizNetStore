import assert from 'node:assert/strict'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const origin = process.env.APP_ORIGIN || 'http://127.0.0.1:3000'
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error('P0 HTTP safety regression requires Supabase URL, anon key, and service-role key')
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const createdUserIds = []
const password = 'P0-Http-Safety-Only-2026!'
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=',
  'base64',
)
const spoofBytes = Buffer.from('not-a-real-image')
const eicarPdf = Buffer.concat([
  Buffer.from('%PDF-1.4\n', 'ascii'),
  Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*', 'ascii'),
  Buffer.from('\n%%EOF\n', 'ascii'),
])

function cookieHeader(cookieJar) {
  return [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
}

async function createUser(label) {
  const email = `p0-http-${label}-${runId}@example.test`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) throw error || new Error(`Unable to create P0 ${label}`)
  createdUserIds.push(data.user.id)

  const cookieJar = new Map()
  const client = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      get(name) { return cookieJar.get(name) },
      set(name, value) { cookieJar.set(name, value) },
      remove(name) { cookieJar.delete(name) },
    },
  })
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError
  return { id: data.user.id, cookie: cookieHeader(cookieJar) }
}

async function appFetch(path, { cookie, method = 'GET', json, body } = {}) {
  const headers = new Headers()
  if (cookie) headers.set('cookie', cookie)
  if (json !== undefined) headers.set('content-type', 'application/json')
  return fetch(`${origin}${path}`, {
    method,
    headers,
    body: json !== undefined ? JSON.stringify(json) : body,
    redirect: 'manual',
  })
}

async function expectStatus(label, response, expected) {
  const text = await response.clone().text().catch(() => '')
  assert.equal(
    response.status,
    expected,
    `${label}: expected HTTP ${expected}, received ${response.status}; body=${text.slice(0, 800)}`,
  )
  process.stdout.write(`ok - ${label} -> ${expected}\n`)
  return text ? JSON.parse(text) : null
}

async function uploadSignedBytes(uploadURL, bytes, contentType) {
  const response = await fetch(uploadURL, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: bytes,
  })
  const text = await response.clone().text().catch(() => '')
  assert.ok(response.ok, `signed quarantine upload failed: ${response.status}; ${text.slice(0, 500)}`)
}

async function assertScanJob(uploadId, expectedStatus, expectedBucket) {
  const { data, error } = await admin
    .from('upload_scan_jobs')
    .select('actor_id, destination_bucket, destination_path, quarantine_path, status, verified_mime, sha256, scanner_result_code')
    .eq('id', uploadId)
    .single()
  if (error) throw error
  assert.equal(data.status, expectedStatus)
  assert.equal(data.destination_bucket, expectedBucket)
  return data
}

function brandingForm(bytes, name = 'logo.png') {
  const form = new FormData()
  form.set('slot', 'logo')
  form.set('file', new File([bytes], name, { type: 'image/png' }))
  return form
}

try {
  const buyer = await createUser('buyer')
  const sellerA = await createUser('seller-a')
  const sellerB = await createUser('seller-b')

  await expectStatus(
    'P0 buyer onboarding',
    await appFetch('/api/onboarding/buyer', {
      cookie: buyer.cookie,
      method: 'POST',
      json: { display_name: 'P0 Buyer' },
    }),
    200,
  )
  await expectStatus(
    'P0 seller A onboarding',
    await appFetch('/api/onboarding/seller', {
      cookie: sellerA.cookie,
      method: 'POST',
      json: { storefront_name: 'P0 Seller A', business_type: 'individual' },
    }),
    200,
  )
  await expectStatus(
    'P0 seller B onboarding',
    await appFetch('/api/onboarding/seller', {
      cookie: sellerB.cookie,
      method: 'POST',
      json: { storefront_name: 'P0 Seller B', business_type: 'individual' },
    }),
    200,
  )

  // KYC provenance + malware boundary. The promoted path belongs to Seller A;
  // Seller B must not be able to register it through /api/kyc/documents.
  const kycUpload = await expectStatus(
    'seller can initialize private KYC quarantine upload',
    await appFetch('/api/kyc/upload', {
      cookie: sellerA.cookie,
      method: 'POST',
      json: { documentType: 'identity', fileName: 'id.png', fileSize: onePixelPng.length, mimeType: 'image/png' },
    }),
    200,
  )
  await uploadSignedBytes(kycUpload.uploadURL, onePixelPng, 'image/png')
  const finalizedKyc = await expectStatus(
    'seller A can scan and promote owned KYC document',
    await appFetch('/api/kyc/upload', {
      cookie: sellerA.cookie,
      method: 'PUT',
      json: { uploadId: kycUpload.uploadId },
    }),
    200,
  )
  const cleanKycJob = await assertScanJob(kycUpload.uploadId, 'clean', 'kyc-documents')
  assert.equal(cleanKycJob.actor_id, sellerA.id)
  assert.equal(cleanKycJob.verified_mime, 'image/png')
  assert.match(cleanKycJob.sha256, /^[0-9a-f]{64}$/)

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
    'seller discards unregistered clean KYC promotion',
    await appFetch('/api/kyc/upload', {
      cookie: sellerA.cookie,
      method: 'DELETE',
      json: { uploadId: kycUpload.uploadId },
    }),
    200,
  )

  const infectedKycUpload = await expectStatus(
    'seller initializes EICAR KYC regression upload',
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
  const blockedKycObject = await admin.storage.from('kyc-documents').download(blockedKycJob.destination_path)
  assert.ok(blockedKycObject.error, 'EICAR fixture unexpectedly reached KYC destination storage')

  // Public product media must be clean before promotion and owner-scoped after it.
  const productMediaUpload = await expectStatus(
    'seller initializes clean product-media quarantine upload',
    await appFetch('/api/seller/product-media/upload', {
      cookie: sellerA.cookie,
      method: 'POST',
      json: { fileName: 'product.png', fileSize: onePixelPng.length, mimeType: 'image/png' },
    }),
    200,
  )
  await uploadSignedBytes(productMediaUpload.uploadURL, onePixelPng, 'image/png')
  const productMediaFinal = await expectStatus(
    'seller scans before product-media public promotion',
    await appFetch('/api/seller/product-media/upload', {
      cookie: sellerA.cookie,
      method: 'PUT',
      json: { uploadId: productMediaUpload.uploadId },
    }),
    200,
  )
  const mediaJob = await assertScanJob(productMediaUpload.uploadId, 'clean', 'product-media')
  assert.equal(mediaJob.actor_id, sellerA.id)
  assert.match(mediaJob.sha256, /^[0-9a-f]{64}$/)

  await expectStatus(
    'seller B cannot delete seller A promoted product-media path',
    await appFetch('/api/seller/product-media/upload', {
      cookie: sellerB.cookie,
      method: 'DELETE',
      json: { filePath: productMediaFinal.filePath },
    }),
    400,
  )

  const spoofUpload = await expectStatus(
    'seller initializes spoof-regression product-media quarantine upload',
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

  // Seller branding is a separate ownership boundary and performs its own scan.
  await expectStatus(
    'anonymous branding upload denied',
    await appFetch('/api/seller/branding', { method: 'POST', body: brandingForm(onePixelPng) }),
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
      body: brandingForm(spoofBytes, 'spoofed.png'),
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
  assert.equal(brandingUpload.url.includes(`/seller-branding/${sellerA.id}/logo/`), true)

  await expectStatus(
    'seller A deletes own promoted product media',
    await appFetch('/api/seller/product-media/upload', {
      cookie: sellerA.cookie,
      method: 'DELETE',
      json: { filePath: productMediaFinal.filePath },
    }),
    200,
  )

  process.stdout.write('P0 HTTP upload/media safety regression suite passed\n')
} finally {
  if (createdUserIds.length) {
    const { data: jobs, error: jobsError } = await admin
      .from('upload_scan_jobs')
      .select('quarantine_path, destination_bucket, destination_path')
      .in('actor_id', createdUserIds)

    if (!jobsError && jobs?.length) {
      const quarantinePaths = jobs.map((job) => job.quarantine_path).filter(Boolean)
      if (quarantinePaths.length) {
        await admin.storage.from('upload-quarantine').remove(quarantinePaths)
      }
      for (const bucket of ['kyc-documents', 'product-media', 'seller-branding']) {
        const paths = jobs
          .filter((job) => job.destination_bucket === bucket)
          .map((job) => job.destination_path)
          .filter(Boolean)
        if (paths.length) await admin.storage.from(bucket).remove(paths)
      }
    }
  }

  for (const userId of createdUserIds.reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) process.stderr.write(`warning: unable to delete P0 HTTP user ${userId}: ${error.message}\n`)
  }
}
