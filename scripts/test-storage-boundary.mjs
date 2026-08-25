import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=',
  'base64',
)

const cases = [
  { bucket: 'kyc-documents', expectedPublic: false, path: `boundary-test/${runId}/kyc.png` },
  { bucket: 'message-attachments', expectedPublic: false, path: `boundary-test/${runId}/message.png` },
  { bucket: 'product-media', expectedPublic: true, path: `boundary-test/${runId}/product.png` },
  { bucket: 'seller-branding', expectedPublic: true, path: `boundary-test/${runId}/branding.png` },
]

const uploaded = []

try {
  const { data: buckets, error: bucketError } = await admin.storage.listBuckets()
  if (bucketError) throw bucketError

  for (const testCase of cases) {
    const bucket = buckets.find((item) => item.id === testCase.bucket)
    assert.ok(bucket, `missing Storage bucket ${testCase.bucket}`)
    assert.equal(
      Boolean(bucket.public),
      testCase.expectedPublic,
      `${testCase.bucket} public flag drifted`,
    )

    const { error: uploadError } = await admin.storage.from(testCase.bucket).upload(
      testCase.path,
      png,
      { contentType: 'image/png', upsert: false },
    )
    if (uploadError) throw uploadError
    uploaded.push(testCase)

    const publicUrl = admin.storage.from(testCase.bucket).getPublicUrl(testCase.path).data.publicUrl
    const response = await fetch(publicUrl, { redirect: 'manual' })

    if (testCase.expectedPublic) {
      assert.equal(
        response.status,
        200,
        `${testCase.bucket} must serve intentionally public commerce media without a signed URL`,
      )
    } else {
      assert.notEqual(
        response.status,
        200,
        `${testCase.bucket} unexpectedly served a private object through a public URL`,
      )
    }

    process.stdout.write(
      `ok - ${testCase.bucket} ${testCase.expectedPublic ? 'public' : 'private'} boundary\n`,
    )
  }

  process.stdout.write('Storage bucket boundary regression suite passed\n')
} finally {
  for (const testCase of uploaded.reverse()) {
    const { error } = await admin.storage.from(testCase.bucket).remove([testCase.path])
    if (error) {
      process.stderr.write(
        `warning: unable to remove ${testCase.bucket}/${testCase.path}: ${error.message}\n`,
      )
    }
  }
}
