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
