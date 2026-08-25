import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { logOperationalError, type OperationalEventRecord } from '../lib/observability/operationalEvent.ts'

test('logs only allow-listed provider error fields and returns the same safe record', () => {
  const logs: Array<{ message: string; details: OperationalEventRecord }> = []
  const jwt = 'eyJabcdefghijk.abcdefghijklmnop.abcdefghijklmnop'
  const secretKey = 'sb_secret_abcdefghijklmnopqrstuvwxyz'

  const record = logOperationalError(
    'storage.kyc.init_failed',
    {
      message: `upload failed https://example.test/object?token=super-secret Bearer bearer-secret ${jwt} ${secretKey}`,
      code: 'storage_error',
      statusCode: 503,
      secret: 'must-not-leak',
      signedUrl: 'https://example.test/private?token=must-not-leak-either',
    },
    {
      component: 'storage',
      operation: 'create-signed-upload-url',
      bucket: 'kyc-documents',
      route: '/api/kyc/upload',
      actorId: 'seller-123',
      recordId: 'document-456',
    },
    (message, details) => logs.push({ message, details }),
  )

  assert.equal(logs.length, 1)
  assert.equal(logs[0].message, 'EntizNetStore operational error')
  assert.equal(record.event, 'storage.kyc.init_failed')
  assert.equal(record.severity, 'error')
  assert.deepEqual(record, logs[0].details)
  assert.equal(logs[0].details.errorCode, 'storage_error')
  assert.equal(logs[0].details.errorStatus, 503)
  assert.equal(typeof logs[0].details.actorFingerprint, 'string')
  assert.equal(typeof logs[0].details.recordFingerprint, 'string')
  assert.notEqual(logs[0].details.actorFingerprint, 'seller-123')
  assert.notEqual(logs[0].details.recordFingerprint, 'document-456')

  const serialized = JSON.stringify(logs[0])
  assert.equal(serialized.includes('must-not-leak'), false)
  assert.equal(serialized.includes('super-secret'), false)
  assert.equal(serialized.includes('bearer-secret'), false)
  assert.equal(serialized.includes(jwt), false)
  assert.equal(serialized.includes(secretKey), false)
  assert.match(String(logs[0].details.errorMessage), /\[REDACTED\]/)
})

test('contains thrown errors without logging stack traces', () => {
  const logs: Array<{ message: string; details: OperationalEventRecord }> = []
  const error = new Error('network unavailable?access_token=private-value')
  error.stack = 'stack with private-value that must never be serialized'

  logOperationalError(
    'storage.product_media.delete_failed',
    error,
    {
      component: 'storage',
      operation: 'delete-object',
      bucket: 'product-media',
    },
    (message, details) => logs.push({ message, details }),
  )

  assert.equal(logs.length, 1)
  assert.equal(logs[0].details.errorName, 'Error')
  assert.equal(String(logs[0].details.errorMessage).includes('private-value'), false)
  assert.equal(JSON.stringify(logs[0]).includes('stack with'), false)
})

test('truncates large error strings', () => {
  const logs: Array<{ message: string; details: OperationalEventRecord }> = []
  logOperationalError(
    'storage.generic.failed',
    'x'.repeat(2000),
    { component: 'storage', operation: 'unknown' },
    (message, details) => logs.push({ message, details }),
  )

  assert.equal(String(logs[0].details.errorMessage).length, 500)
})

test('sensitive production routes must persist safe events and cannot regress to raw console logging', () => {
  const criticalRoutes = [
    'app/api/health/route.ts',
    'app/api/kyc/documents/route.ts',
    'app/api/kyc/upload/route.ts',
    'app/api/messages/attachments/upload/route.ts',
    'app/api/seller/branding/route.ts',
    'app/api/seller/product-media/upload/route.ts',
  ]

  for (const relativePath of criticalRoutes) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
    assert.match(source, /reportOperationalError\s*\(/, `${relativePath} must persist safe operational failures`)
    assert.doesNotMatch(source, /\bconsole\.error\s*\(/, `${relativePath} must not log raw errors`)
  }
})
