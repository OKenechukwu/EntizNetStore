import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

export const CANONICAL_PRODUCTION_APP_ORIGIN = 'https://entiznetstore.vercel.app'
export const CANONICAL_PRODUCTION_SUPABASE_ORIGIN = 'https://kllwwurklumhawfsilpd.supabase.co'

function cleanHttpsOrigin(raw, label) {
  const requested = new URL(raw)
  if (requested.protocol !== 'https:') throw new Error(`${label} must use HTTPS`)
  if (requested.username || requested.password || requested.search || requested.hash) {
    throw new Error(`${label} must be a clean origin without credentials, query or hash`)
  }
  if (requested.pathname !== '/' && requested.pathname !== '') {
    throw new Error(`${label} must be an origin URL, not a path-scoped URL`)
  }
  return new URL(requested.origin)
}

export function fingerprintSupabaseOrigin(raw) {
  const origin = new URL(raw).origin
  return createHash('sha256')
    .update(`entiznetstore:supabase-origin:v1:${origin}`)
    .digest('hex')
    .slice(0, 24)
}

export function resolveHostedM4ATarget() {
  const rawAppOrigin = process.env.APP_ORIGIN
  const rawSupabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const expectedCommit = process.env.M4A_EXPECTED_COMMIT_SHA || ''
  const environment = process.env.M4A_HTTP_TEST_ENVIRONMENT || ''
  const mutationConsent = process.env.M4A_HTTP_ALLOW_REMOTE_MUTATION
  const configuredProductionSupabaseUrl = process.env.DEPLOYED_PRODUCTION_SUPABASE_URL || ''
  const vercelBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || ''

  if (!rawAppOrigin || !rawSupabaseUrl) {
    throw new Error('APP_ORIGIN and SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL are required for hosted M4A verification')
  }
  if (!/^[0-9a-f]{40}$/i.test(expectedCommit)) {
    throw new Error('M4A_EXPECTED_COMMIT_SHA must be an exact 40-character Git SHA')
  }
  if (!['preview', 'staging'].includes(environment)) {
    throw new Error('M4A_HTTP_TEST_ENVIRONMENT must be preview or staging; production is intentionally refused')
  }
  if (mutationConsent !== 'true') {
    throw new Error('M4A_HTTP_ALLOW_REMOTE_MUTATION=true is required because this gate creates disposable commerce fixtures')
  }

  const appOrigin = cleanHttpsOrigin(rawAppOrigin, 'hosted M4A application target')
  const supabaseOrigin = cleanHttpsOrigin(rawSupabaseUrl, 'hosted M4A Supabase target')

  if (appOrigin.origin === CANONICAL_PRODUCTION_APP_ORIGIN) {
    throw new Error('canonical production EntizNetStore host is forbidden for hosted M4A fixtures')
  }

  const forbiddenSupabaseOrigins = new Set([CANONICAL_PRODUCTION_SUPABASE_ORIGIN])
  if (configuredProductionSupabaseUrl) {
    forbiddenSupabaseOrigins.add(
      cleanHttpsOrigin(configuredProductionSupabaseUrl, 'configured production Supabase target').origin,
    )
  }
  if (forbiddenSupabaseOrigins.has(supabaseOrigin.origin)) {
    throw new Error('hosted M4A fixtures must use an isolated non-production Supabase project or branch')
  }

  if (appOrigin.hostname.endsWith('.vercel.app') && !vercelBypassSecret) {
    throw new Error('VERCEL_AUTOMATION_BYPASS_SECRET is required for protected Vercel hosted M4A verification')
  }

  return {
    appOrigin,
    supabaseOrigin,
    expectedCommit,
    environment,
    vercelBypassSecret,
    expectedBackendBinding: fingerprintSupabaseOrigin(supabaseOrigin.origin),
  }
}

export function createHostedAppFetch(target, nativeFetch = globalThis.fetch.bind(globalThis)) {
  return async (input, init = undefined) => {
    const requestUrl = input instanceof Request ? new URL(input.url) : new URL(String(input))
    if (requestUrl.origin !== target.appOrigin.origin || !target.vercelBypassSecret) {
      return nativeFetch(input, init)
    }

    const headers = new Headers(input instanceof Request ? input.headers : undefined)
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value))
    }
    headers.set('x-vercel-protection-bypass', target.vercelBypassSecret)
    headers.set('x-vercel-set-bypass-cookie', 'true')
    headers.set('user-agent', 'EntizNetStore-M4A-hosted-verification/1.0')

    return nativeFetch(input, { ...init, headers })
  }
}

export async function preflightHostedM4A(target, fetchImpl) {
  const response = await fetchImpl(new URL('/api/health', target.appOrigin), {
    method: 'GET',
    redirect: 'manual',
    cache: 'no-store',
  })
  const text = await response.clone().text().catch(() => '')
  assert.equal(
    response.status,
    200,
    `isolated hosted health check expected HTTP 200, received ${response.status}; body=${text.slice(0, 800)}`,
  )

  let health
  try {
    health = JSON.parse(text)
  } catch {
    throw new Error(`isolated hosted health response was not JSON: ${text.slice(0, 400)}`)
  }

  assert.equal(health.status, 'ok', `isolated hosted health status was ${health.status}`)
  assert.equal(health.service, 'entiznetstore', 'isolated hosted health returned the wrong service identity')
  assert.equal(
    health.version,
    target.expectedCommit.slice(0, 12),
    'isolated hosted deployment does not match the exact expected Git SHA',
  )
  assert.equal(health.checks?.database, 'ok', 'isolated hosted database readiness is not healthy')
  assert.equal(health.checks?.storage, 'ok', 'isolated hosted storage readiness is not healthy')
  assert.equal(health.checks?.operations, 'ok', 'isolated hosted operational-event readiness is not healthy')
  assert.equal(
    health.backendBinding,
    target.expectedBackendBinding,
    'isolated hosted server backend binding does not match the requested non-production Supabase origin',
  )

  const csp = response.headers.get('content-security-policy') || ''
  assert.ok(csp, 'isolated hosted deployment did not return the expected Content-Security-Policy header')
  assert.ok(
    csp.includes(target.supabaseOrigin.origin),
    'isolated hosted deployment CSP is not bound to the requested non-production Supabase origin',
  )
  assert.equal(
    csp.includes(new URL(CANONICAL_PRODUCTION_SUPABASE_ORIGIN).hostname),
    false,
    'isolated hosted deployment CSP still references canonical production Supabase',
  )

  process.stdout.write(
    `ok - hosted M4A preflight -> ${target.environment}, exact ${target.expectedCommit.slice(0, 12)}, isolated browser + server Supabase binding confirmed\n`,
  )
  return health
}
