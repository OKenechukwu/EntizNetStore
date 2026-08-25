import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type CheckStatus = 'ok' | 'unavailable'

const requiredStorageBuckets = [
  { id: 'kyc-documents', public: false },
  { id: 'message-attachments', public: false },
  { id: 'product-media', public: true },
  { id: 'seller-branding', public: true },
] as const

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 300)
  if (typeof error === 'string') return error.slice(0, 300)
  return 'unknown health-check error'
}

function responseHeaders() {
  return {
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Robots-Tag': 'noindex, nofollow',
  }
}

export async function GET() {
  const startedAt = Date.now()
  let database: CheckStatus = 'unavailable'
  let storage: CheckStatus = 'unavailable'
  let databaseError: string | null = null
  let storageError: string | null = null

  try {
    const admin = getSupabaseAdmin()
    const [databaseResult, storageResult] = await Promise.all([
      admin.from('profiles_buyer').select('id').limit(1),
      admin.storage.listBuckets(),
    ])

    if (databaseResult.error) {
      databaseError = safeErrorMessage(databaseResult.error.message || 'database health check failed')
    } else {
      database = 'ok'
    }

    if (storageResult.error) {
      storageError = safeErrorMessage(storageResult.error.message || 'storage health check failed')
    } else {
      const bucketById = new Map(storageResult.data.map((bucket) => [bucket.id, bucket]))
      const storageBoundaryMatches = requiredStorageBuckets.every((expected) => {
        const actual = bucketById.get(expected.id)
        return actual?.public === expected.public
      })

      if (storageBoundaryMatches) {
        storage = 'ok'
      } else {
        storageError = 'required storage bucket boundary is missing or misconfigured'
      }
    }
  } catch (error) {
    const message = safeErrorMessage(error)
    databaseError = databaseError ?? message
    storageError = storageError ?? message
  }

  const checks = { database, storage }
  const healthy = database === 'ok' && storage === 'ok'

  if (!healthy) {
    console.error('EntizNetStore readiness check failed', {
      checks,
      databaseError,
      storageError,
    })
  }

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      service: 'entiznetstore',
      checks,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null,
      durationMs: Date.now() - startedAt,
    },
    {
      status: healthy ? 200 : 503,
      headers: responseHeaders(),
    },
  )
}
