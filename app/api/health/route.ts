import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { reportOperationalError } from '@/lib/observability/operationalEventSink'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type CheckStatus = 'ok' | 'degraded' | 'unavailable'

const requiredStorageBuckets = [
  { id: 'kyc-documents', public: false },
  { id: 'message-attachments', public: false },
  { id: 'upload-quarantine', public: false },
  { id: 'product-media', public: true },
  { id: 'seller-branding', public: true },
] as const

function responseHeaders() {
  return {
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Robots-Tag': 'noindex, nofollow',
  }
}

function serverSupabaseBinding(): string | null {
  const rawUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!rawUrl) return null

  try {
    const origin = new URL(rawUrl).origin
    return createHash('sha256')
      .update(`entiznetstore:supabase-origin:v1:${origin}`)
      .digest('hex')
      .slice(0, 24)
  } catch {
    return null
  }
}

export async function GET() {
  const startedAt = Date.now()
  let database: CheckStatus = 'unavailable'
  let storage: CheckStatus = 'unavailable'
  let operations: CheckStatus = 'unavailable'

  try {
    const admin = getSupabaseAdmin()
    const [databaseResult, storageResult] = await Promise.all([
      admin.from('profiles_buyer').select('id').limit(1),
      admin.storage.listBuckets(),
    ])

    if (databaseResult.error) {
      await reportOperationalError('readiness.database_unavailable', databaseResult.error, {
        component: 'readiness',
        operation: 'database-readiness-check',
        route: '/api/health',
      })
    } else {
      database = 'ok'
    }

    if (storageResult.error) {
      await reportOperationalError('readiness.storage_unavailable', storageResult.error, {
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
        await reportOperationalError(
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

    if (database === 'ok') {
      const { data: operationalHealth, error: operationalHealthError } = await admin.rpc(
        'operational_event_health',
        { p_window_minutes: 15, p_threshold: 5 },
      )

      if (operationalHealthError) {
        await reportOperationalError(
          'readiness.operational_event_health_failed',
          operationalHealthError,
          {
            component: 'readiness',
            operation: 'operational-event-health-check',
            route: '/api/health',
          },
        )
      } else {
        const row = Array.isArray(operationalHealth) ? operationalHealth[0] : operationalHealth
        operations = row?.status === 'degraded' ? 'degraded' : row?.status === 'ok' ? 'ok' : 'unavailable'
      }
    }
  } catch (error) {
    await reportOperationalError('readiness.check_failed', error, {
      component: 'readiness',
      operation: 'readiness-check',
      route: '/api/health',
    })
  }

  const checks = { database, storage, operations }
  const healthy = database === 'ok' && storage === 'ok' && operations === 'ok'

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      service: 'entiznetstore',
      checks,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null,
      backendBinding: serverSupabaseBinding(),
      durationMs: Date.now() - startedAt,
    },
    {
      status: healthy ? 200 : 503,
      headers: responseHeaders(),
    },
  )
}
