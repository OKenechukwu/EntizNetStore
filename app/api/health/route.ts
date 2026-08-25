import { NextResponse } from 'next/server'
import { logOperationalError } from '@/lib/observability/operationalEvent'
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

  try {
    const admin = getSupabaseAdmin()
    const [databaseResult, storageResult] = await Promise.all([
      admin.from('profiles_buyer').select('id').limit(1),
      admin.storage.listBuckets(),
    ])

    if (databaseResult.error) {
      logOperationalError('readiness.database_unavailable', databaseResult.error, {
        component: 'readiness',
        operation: 'database-readiness-check',
        route: '/api/health',
      })
    } else {
      database = 'ok'
    }

    if (storageResult.error) {
      logOperationalError('readiness.storage_unavailable', storageResult.error, {
        component: 'readiness',
        operation: 'storage-readiness-check',
        route: '/api/health',
      })
    } else {
      const bucketById = new Map(storageResult.data.map((bucket) => [bucket.id, bucket]))
      const storageBoundaryMatches = requiredStorageBuckets.every((expected) => {
        const actual = bucketById.get(expected.id)
        return actual?.public === expected.public
      })

      if (storageBoundaryMatches) {
        storage = 'ok'
      } else {
        logOperationalError(
          'readiness.storage_boundary_misconfigured',
          'required storage bucket boundary is missing or misconfigured',
          {
            component: 'readiness',
            operation: 'storage-boundary-check',
            route: '/api/health',
          },
        )
      }
    }
  } catch (error) {
    logOperationalError('readiness.check_failed', error, {
      component: 'readiness',
      operation: 'readiness-check',
      route: '/api/health',
    })
  }

  const checks = { database, storage }
  const healthy = database === 'ok' && storage === 'ok'

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
