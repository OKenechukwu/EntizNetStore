import assert from 'node:assert/strict'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const origin = process.env.APP_ORIGIN || 'http://127.0.0.1:3000'
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error('Supabase URL, anon key and service-role key are required')
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
const password = 'UploadSafety-Regression-2026!'
let userId = null

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=',
  'base64',
)

function cookieHeader(cookieJar) {
  return [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
}

async function appFetch(path, { cookie, method = 'GET', json } = {}) {
  const headers = new Headers()
  if (cookie) headers.set('cookie', cookie)
  if (json !== undefined) headers.set('content-type', 'application/json')
  return fetch(`${origin}${path}`, {
    method,
    headers,
    body: json !== undefined ? JSON.stringify(json) : undefined,
    redirect: 'manual',
  })
}

async function expectJson(label, response, expectedStatus) {
  const text = await response.text()
  assert.equal(
    response.status,
    expectedStatus,
    `${label}: expected ${expectedStatus}, got ${response.status}; body=${text.slice(0, 800)}`,
  )
  process.stdout.write(`ok - ${label} -> ${expectedStatus}\n`)
  return text ? JSON.parse(text) : null
}

async function signedPut(url, bytes, mimeType) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'content-type': mimeType },
    body: bytes,
  })
  const text = await response.text().catch(() => '')
  assert.ok(response.ok, `signed quarantine PUT failed: ${response.status}; ${text.slice(0, 500)}`)
}

async function createSeller() {
  const email = `upload-safety-${runId}@example.test`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) throw error || new Error('unable to create upload-safety user')
  userId = data.user.id

  const cookies = new Map()
  const authClient = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      get(name) { return cookies.get(name) },
      set(name, value) { cookies.set(name, value) },
      remove(name) { cookies.delete(name) },
    },
  })
  const { error: signInError } = await authClient.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError

  const cookie = cookieHeader(cookies)
  await expectJson(
    'upload-safety seller onboarding',
    await appFetch('/api/onboarding/seller', {
      cookie,
      method: 'POST',
      json: { storefront_name: 'Upload Safety Seller', business_type: 'individual' },
    }),
    200,
  )
  return { id: data.user.id, cookie }
}

async function initKyc(cookie, documentType = 'identity') {
  return expectJson(
    `initialize ${documentType} KYC quarantine`,
    await appFetch('/api/kyc/upload', {
      cookie,
      method: 'POST',
      json: {
        documentType,
        fileName: `${documentType}.png`,
        fileSize: onePixelPng.length,
        mimeType: 'image/png',
      },
    }),
    200,
  )
}

async function cleanupUserObjects() {
  if (!userId) return
  const { data: jobs } = await admin
    .from('upload_scan_jobs')
    .select('quarantine_path, destination_bucket, destination_path')
    .eq('actor_id', userId)

  if (jobs?.length) {
    const quarantine = jobs.map((job) => job.quarantine_path).filter(Boolean)
    if (quarantine.length) await admin.storage.from('upload-quarantine').remove(quarantine)
    for (const bucket of ['kyc-documents', 'product-media', 'seller-branding', 'message-attachments']) {
      const paths = jobs
        .filter((job) => job.destination_bucket === bucket)
        .map((job) => job.destination_path)
        .filter(Boolean)
      if (paths.length) await admin.storage.from(bucket).remove(paths)
    }
  }
  await admin.from('kyc_documents').delete().eq('seller_id', userId)
}

try {
  const seller = await createSeller()

  const registrationUpload = await initKyc(seller.cookie, 'identity')
  assert.equal(registrationUpload.bucket, 'upload-quarantine')
  assert.match(registrationUpload.uploadId, /^[0-9a-f-]{36}$/i)
  await signedPut(registrationUpload.uploadURL, onePixelPng, 'image/png')

  const finalized = await expectJson(
    'clean KYC scan promotes before registration',
    await appFetch('/api/kyc/upload', {
      cookie: seller.cookie,
      method: 'PUT',
      json: { uploadId: registrationUpload.uploadId },
    }),
    200,
  )
  assert.equal(finalized.filePath.startsWith(`${seller.id}/identity/`), true)

  const registered = await expectJson(
    'clean scan job registers KYC evidence',
    await appFetch('/api/kyc/documents', {
      cookie: seller.cookie,
      method: 'POST',
      json: {
        documentType: 'identity',
        filePath: finalized.filePath,
        fileName: 'identity.png',
        fileSize: finalized.fileSize,
        mimeType: finalized.mimeType,
      },
    }),
    201,
  )
  assert.match(registered.document.id, /^[0-9a-f-]{36}$/i)

  const { data: registeredJob, error: registeredJobError } = await admin
    .from('upload_scan_jobs')
    .select('status, registered_at, registered_record_id')
    .eq('id', registrationUpload.uploadId)
    .single()
  if (registeredJobError) throw registeredJobError
  assert.equal(registeredJob.status, 'registered')
  assert.equal(registeredJob.registered_record_id, registered.document.id)
  assert.ok(registeredJob.registered_at)

  const { data: linkedDocument, error: linkedDocumentError } = await admin
    .from('kyc_documents')
    .select('id, upload_scan_job_id')
    .eq('id', registered.document.id)
    .single()
  if (linkedDocumentError) throw linkedDocumentError
  assert.equal(linkedDocument.upload_scan_job_id, registrationUpload.uploadId)

  await expectJson(
    'registered KYC evidence cannot be discarded by upload cleanup',
    await appFetch('/api/kyc/upload', {
      cookie: seller.cookie,
      method: 'DELETE',
      json: { uploadId: registrationUpload.uploadId },
    }),
    409,
  )
  await expectJson(
    'registered KYC evidence cannot be finalized again',
    await appFetch('/api/kyc/upload', {
      cookie: seller.cookie,
      method: 'PUT',
      json: { uploadId: registrationUpload.uploadId },
    }),
    409,
  )
  await expectJson(
    'same promoted KYC path cannot be registered twice',
    await appFetch('/api/kyc/documents', {
      cookie: seller.cookie,
      method: 'POST',
      json: {
        documentType: 'identity',
        filePath: finalized.filePath,
        fileName: 'identity-duplicate.png',
      },
    }),
    409,
  )

  const concurrentUpload = await expectJson(
    'initialize product-media concurrency fixture',
    await appFetch('/api/seller/product-media/upload', {
      cookie: seller.cookie,
      method: 'POST',
      json: {
        fileName: 'concurrent.png',
        fileSize: onePixelPng.length,
        mimeType: 'image/png',
      },
    }),
    200,
  )
  await signedPut(concurrentUpload.uploadURL, onePixelPng, 'image/png')

  const concurrentResponses = await Promise.all([
    appFetch('/api/seller/product-media/upload', {
      cookie: seller.cookie,
      method: 'PUT',
      json: { uploadId: concurrentUpload.uploadId },
    }),
    appFetch('/api/seller/product-media/upload', {
      cookie: seller.cookie,
      method: 'PUT',
      json: { uploadId: concurrentUpload.uploadId },
    }),
  ])
  const statuses = concurrentResponses.map((response) => response.status).sort((a, b) => a - b)
  assert.equal(statuses.includes(200), true, `concurrent finalization produced no success: ${statuses.join(',')}`)
  assert.equal(
    statuses.every((status) => status === 200 || status === 409),
    true,
    `concurrent finalization returned unexpected statuses: ${statuses.join(',')}`,
  )
  process.stdout.write(`ok - concurrent product finalization is single-writer/idempotent -> ${statuses.join(',')}\n`)

  const { data: concurrentJob, error: concurrentJobError } = await admin
    .from('upload_scan_jobs')
    .select('status, destination_path, scanner, sha256')
    .eq('id', concurrentUpload.uploadId)
    .single()
  if (concurrentJobError) throw concurrentJobError
  assert.equal(concurrentJob.status, 'clean')
  assert.equal(concurrentJob.scanner, 'deterministic-ci')
  assert.match(concurrentJob.sha256, /^[0-9a-f]{64}$/)
  const { data: promotedBlob, error: promotedError } = await admin.storage
    .from('product-media')
    .download(concurrentJob.destination_path)
  if (promotedError || !promotedBlob) throw promotedError || new Error('clean concurrent fixture was not promoted')
  assert.equal(promotedBlob.size, onePixelPng.length)

  process.stdout.write('Upload safety HTTP lifecycle regression suite passed\n')
} finally {
  await cleanupUserObjects().catch((error) => {
    process.stderr.write(`warning: upload-safety object cleanup failed: ${error instanceof Error ? error.message : String(error)}\n`)
  })
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) process.stderr.write(`warning: upload-safety user cleanup failed: ${error.message}\n`)
  }
}
