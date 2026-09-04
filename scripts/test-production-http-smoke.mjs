const rawBaseUrl = process.env.ENTIZNETSTORE_BASE_URL || process.argv[2]
const rawExpectedSha = process.env.ENTIZNETSTORE_EXPECTED_SHA?.trim().toLowerCase() || ''
const rawExpectedBackendBinding =
  process.env.ENTIZNETSTORE_EXPECTED_BACKEND_BINDING?.trim().toLowerCase() || ''

if (!rawBaseUrl) {
  console.error('Usage: ENTIZNETSTORE_BASE_URL=https://entiznetstore.example npm run test:production-http-smoke')
  process.exit(2)
}

if (rawExpectedSha && !/^[0-9a-f]{12,40}$/.test(rawExpectedSha)) {
  console.error('ENTIZNETSTORE_EXPECTED_SHA must be a 12..40 character hexadecimal Git SHA')
  process.exit(2)
}

if (rawExpectedBackendBinding && !/^[0-9a-f]{24}$/.test(rawExpectedBackendBinding)) {
  console.error('ENTIZNETSTORE_EXPECTED_BACKEND_BINDING must be a 24 character hexadecimal binding fingerprint')
  process.exit(2)
}

const expectedVersion = rawExpectedSha ? rawExpectedSha.slice(0, 12) : null

let baseUrl
try {
  baseUrl = new URL(rawBaseUrl)
} catch {
  console.error('ENTIZNETSTORE_BASE_URL must be a valid absolute URL')
  process.exit(2)
}

if (baseUrl.protocol !== 'https:' && baseUrl.hostname !== 'localhost' && baseUrl.hostname !== '127.0.0.1') {
  console.error('Production smoke targets must use HTTPS')
  process.exit(2)
}

const failures = []
let indexingLaunchGate = null

function fail(message) {
  failures.push(message)
}

function expectNoStore(response, path) {
  const cacheControl = response.headers.get('cache-control') || ''
  if (!/\bno-store\b/i.test(cacheControl)) {
    fail(`${path} must return Cache-Control with no-store, got: ${cacheControl || 'missing'}`)
  }
}

async function request(path, expectedStatus, verifyBody) {
  const url = new URL(path, baseUrl)
  let response
  try {
    response = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': 'EntizNetStore-release-smoke/1.0' },
    })
  } catch (error) {
    fail(`${path} request failed: ${error instanceof Error ? error.message : 'unknown fetch error'}`)
    return
  }

  if (response.status !== expectedStatus) {
    fail(`${path} expected HTTP ${expectedStatus}, got ${response.status}`)
  }

  if (path.startsWith('/api/')) expectNoStore(response, path)

  if (verifyBody) {
    const body = await response.json().catch(() => null)
    try {
      verifyBody(body)
    } catch (error) {
      fail(`${path} response validation failed: ${error instanceof Error ? error.message : 'invalid response'}`)
    }
  }
}

await request('/', 200)
await request('/api/health', 200, (body) => {
  if (
    body?.status !== 'ok' ||
    body?.service !== 'entiznetstore' ||
    body?.checks?.database !== 'ok' ||
    body?.checks?.storage !== 'ok' ||
    body?.checks?.operations !== 'ok' ||
    body?.checks?.payments !== 'ok'
  ) {
    throw new Error(
      'readiness response did not report database=ok, storage=ok, operations=ok and payments=ok',
    )
  }

  if (!['configured', 'blocked'].includes(body?.launchGates?.uploadSafety)) {
    throw new Error('readiness response did not report the bounded upload-safety launch gate')
  }
  if (!['enabled', 'blocked'].includes(body?.launchGates?.indexing)) {
    throw new Error('readiness response did not report the bounded indexing launch gate')
  }
  if (!['configured', 'blocked'].includes(body?.launchGates?.storeChat)) {
    throw new Error('readiness response did not report the bounded Store Chat launch gate')
  }
  if (!['configured', 'blocked'].includes(body?.launchGates?.messageTranslation)) {
    throw new Error('readiness response did not report the bounded message-translation launch gate')
  }

  indexingLaunchGate = body.launchGates.indexing

  if (!/^[0-9a-f]{24}$/.test(body?.backendBinding || '')) {
    throw new Error('readiness response did not expose a valid backend binding fingerprint')
  }
  if (rawExpectedBackendBinding && body.backendBinding !== rawExpectedBackendBinding) {
    throw new Error(
      `production backend drift: expected binding ${rawExpectedBackendBinding}, got ${body.backendBinding || 'missing'}`,
    )
  }
  if (expectedVersion && body?.version !== expectedVersion) {
    throw new Error(`production deployment drift: expected version ${expectedVersion}, got ${body?.version || 'missing'}`)
  }
})

await request('/api/messages/conversations', 401, (body) => {
  if (body?.error !== 'Unauthorized') throw new Error('anonymous messaging route did not fail closed')
})
await request('/api/kyc/status', 401, (body) => {
  if (body?.error !== 'Unauthorized') throw new Error('anonymous KYC route did not fail closed')
})
await request('/api/integrations/entiznet/admin/health', 401)
await request('/api/integrations/entiznet/admin/accounts', 401)

let crossSiteMutationResponse
try {
  crossSiteMutationResponse = await fetch(new URL('/api/buyer/profile', baseUrl), {
    method: 'PATCH',
    redirect: 'manual',
    headers: {
      'User-Agent': 'EntizNetStore-release-smoke/1.0',
      'Content-Type': 'application/json',
      Origin: 'https://csrf.invalid',
    },
    body: '{}',
  })
} catch (error) {
  fail(`/api/buyer/profile cross-site mutation probe failed: ${error instanceof Error ? error.message : 'unknown fetch error'}`)
}

if (crossSiteMutationResponse) {
  if (crossSiteMutationResponse.status !== 403) {
    fail(`/api/buyer/profile cross-site mutation expected HTTP 403, got ${crossSiteMutationResponse.status}`)
  }
  expectNoStore(crossSiteMutationResponse, '/api/buyer/profile cross-site mutation')
  const body = await crossSiteMutationResponse.json().catch(() => null)
  if (body?.error !== 'Forbidden') {
    fail('/api/buyer/profile cross-site mutation did not fail at the request-integrity boundary')
  }
}

const rootResponse = await fetch(new URL('/', baseUrl), {
  redirect: 'manual',
  headers: { 'User-Agent': 'EntizNetStore-release-smoke/1.0' },
}).catch(() => null)

if (rootResponse) {
  const csp = rootResponse.headers.get('content-security-policy') || ''
  if (!csp) fail('root response is missing Content-Security-Policy')
  if (/unsafe-eval/i.test(csp)) fail("production CSP must not include 'unsafe-eval'")
  if (!/object-src\s+'none'/i.test(csp)) fail("production CSP must include object-src 'none'")
  if (rootResponse.headers.get('x-content-type-options')?.toLowerCase() !== 'nosniff') {
    fail('root response must set X-Content-Type-Options: nosniff')
  }
  if (rootResponse.headers.get('x-frame-options')?.toUpperCase() !== 'DENY') {
    fail('root response must set X-Frame-Options: DENY')
  }

  const robotsHeader = rootResponse.headers.get('x-robots-tag') || ''
  if (indexingLaunchGate === 'blocked' && !/\bnoindex\b/i.test(robotsHeader)) {
    fail('root response must set X-Robots-Tag noindex while indexing launch gate is blocked')
  }
  if (indexingLaunchGate === 'enabled' && /\bnoindex\b/i.test(robotsHeader)) {
    fail('root response retained X-Robots-Tag noindex after indexing launch gate was enabled')
  }
}

const robotsResponse = await fetch(new URL('/robots.txt', baseUrl), {
  redirect: 'manual',
  headers: { 'User-Agent': 'EntizNetStore-release-smoke/1.0' },
}).catch(() => null)

if (!robotsResponse) {
  fail('/robots.txt request failed')
} else {
  if (robotsResponse.status !== 200) fail(`/robots.txt expected HTTP 200, got ${robotsResponse.status}`)
  const robotsText = await robotsResponse.text()
  const blocksEntireSite = /^Disallow:\s*\/\s*$/im.test(robotsText)
  if (indexingLaunchGate === 'blocked' && !blocksEntireSite) {
    fail('/robots.txt must Disallow: / while indexing launch gate is blocked')
  }
  if (indexingLaunchGate === 'enabled') {
    if (blocksEntireSite) fail('/robots.txt still blocks the entire site after indexing launch gate was enabled')
    for (const path of ['/api/', '/admin/', '/dashboard/', '/checkout/']) {
      const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (!new RegExp(`^Disallow:\\s*${escaped}\\s*$`, 'im').test(robotsText)) {
        fail(`/robots.txt must keep sensitive path non-indexable after launch: ${path}`)
      }
    }
  }
}

if (failures.length) {
  console.error('Production HTTP smoke FAILED:\n')
  failures.forEach((message) => console.error(`- ${message}`))
  process.exit(1)
}

console.log(
  `Production HTTP smoke passed for ${baseUrl.origin}${expectedVersion ? ` at ${expectedVersion}` : ''}${rawExpectedBackendBinding ? ` on backend ${rawExpectedBackendBinding}` : ''}`,
)
