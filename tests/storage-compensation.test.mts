import assert from 'node:assert/strict'
import test from 'node:test'
import { removeStorageObjectBestEffort } from '../lib/storage/compensation.ts'

test('removes the requested object and stays silent on success', async () => {
  const calls: string[][] = []
  const logs: unknown[] = []
  const result = await removeStorageObjectBestEffort(
    {
      async remove(paths) {
        calls.push(paths)
        return { error: null }
      },
    },
    'owner/file.png',
    { bucket: 'seller-branding', operation: 'rollback-branding-update', ownerId: 'owner' },
    (message, details) => logs.push({ message, details }),
  )

  assert.equal(result, true)
  assert.deepEqual(calls, [['owner/file.png']])
  assert.deepEqual(logs, [])
})

test('reports provider cleanup failures without serializing arbitrary provider objects', async () => {
  const logs: Array<{ message: string; details: Record<string, unknown> }> = []
  const result = await removeStorageObjectBestEffort(
    {
      async remove() {
        return { error: { message: 'provider failure', secret: 'must-not-leak' } }
      },
    },
    'seller/document.pdf',
    { bucket: 'kyc-documents', operation: 'rollback-kyc-registration', ownerId: 'seller' },
    (message, details) => logs.push({ message, details }),
  )

  assert.equal(result, false)
  assert.equal(logs.length, 1)
  assert.equal(logs[0].message, 'Storage compensation failed')
  assert.equal(logs[0].details.errorMessage, 'storage provider returned an unknown error')
  assert.equal(JSON.stringify(logs[0]).includes('must-not-leak'), false)
})

test('contains thrown error output and returns false instead of masking the original failure', async () => {
  const logs: Array<{ message: string; details: Record<string, unknown> }> = []
  const result = await removeStorageObjectBestEffort(
    {
      async remove() {
        throw new Error('network unavailable')
      },
    },
    'sender/message/file.pdf',
    { bucket: 'message-attachments', operation: 'rollback-attachment-registration' },
    (message, details) => logs.push({ message, details }),
  )

  assert.equal(result, false)
  assert.equal(logs.length, 1)
  assert.equal(logs[0].message, 'Storage compensation threw')
  assert.equal(logs[0].details.errorName, 'Error')
  assert.equal(logs[0].details.errorMessage, 'network unavailable')
})

test('default compensation logging fingerprints ownership and redacts secrets', async () => {
  const originalConsoleError = console.error
  const captured: unknown[][] = []
  console.error = (...args: unknown[]) => captured.push(args)

  try {
    const result = await removeStorageObjectBestEffort(
      {
        async remove() {
          throw new Error('cleanup failed?access_token=private-value Bearer bearer-secret')
        },
      },
      'seller-123/private/document.pdf',
      {
        bucket: 'kyc-documents',
        operation: 'rollback-kyc-registration',
        ownerId: 'seller-123',
        recordId: 'document-456',
      },
    )

    assert.equal(result, false)
    assert.equal(captured.length, 1)
    assert.equal(captured[0][0], 'EntizNetStore operational error')

    const serialized = JSON.stringify(captured[0])
    assert.equal(serialized.includes('seller-123'), false)
    assert.equal(serialized.includes('document-456'), false)
    assert.equal(serialized.includes('private/document.pdf'), false)
    assert.equal(serialized.includes('private-value'), false)
    assert.equal(serialized.includes('bearer-secret'), false)
    assert.match(serialized, /actorFingerprint/)
    assert.match(serialized, /recordFingerprint/)
    assert.match(serialized, /\[REDACTED\]/)
  } finally {
    console.error = originalConsoleError
  }
})
