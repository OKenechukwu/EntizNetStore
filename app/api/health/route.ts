import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

  try {
    const { error } = await getSupabaseAdmin()
      .from('profiles_buyer')
      .select('id')
      .limit(1)

    if (error) throw new Error(error.message || 'database health check failed')

    return NextResponse.json(
      {
        status: 'ok',
        service: 'entiznetstore',
        checks: { database: 'ok' },
        version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null,
        durationMs: Date.now() - startedAt,
      },
      { status: 200, headers: responseHeaders() },
    )
  } catch (error) {
    console.error('EntizNetStore readiness check failed', {
      check: 'database',
      errorMessage: safeErrorMessage(error),
    })

    return NextResponse.json(
      {
        status: 'degraded',
        service: 'entiznetstore',
        checks: { database: 'unavailable' },
        durationMs: Date.now() - startedAt,
      },
      { status: 503, headers: responseHeaders() },
    )
  }
}
