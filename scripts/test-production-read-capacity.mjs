import { performance } from 'node:perf_hooks'

const rawBaseUrl = process.env.ENTIZNETSTORE_BASE_URL || process.argv[2]
if (!rawBaseUrl) {
  console.error('ENTIZNETSTORE_BASE_URL is required')
  process.exit(2)
}

let baseUrl
try {
  baseUrl = new URL(rawBaseUrl)
} catch {
  console.error('ENTIZNETSTORE_BASE_URL must be an absolute URL')
  process.exit(2)
}

const allowLocal = baseUrl.hostname === 'localhost' || baseUrl.hostname === '127.0.0.1'
if (baseUrl.protocol !== 'https:' && !allowLocal) {
  console.error('Capacity probes require HTTPS outside local development')
  process.exit(2)
}
if (baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
  console.error('Capacity probe URL must not contain credentials, query strings, or fragments')
  process.exit(2)
}

const expectedOrigin = (process.env.CAPACITY_EXPECTED_ORIGIN || '').trim()
if (!allowLocal && (!expectedOrigin || new URL(expectedOrigin).origin !== baseUrl.origin)) {
  console.error('CAPACITY_EXPECTED_ORIGIN must explicitly match the target origin')
  process.exit(2)
}

const rawExpectedSha = (process.env.CAPACITY_EXPECTED_SHA || '').trim().toLowerCase()
if (!allowLocal && !/^[0-9a-f]{12,40}$/.test(rawExpectedSha)) {
  console.error('CAPACITY_EXPECTED_SHA must bind production probes to a 12..40 character hexadecimal Git SHA')
  process.exit(2)
}
if (rawExpectedSha && !/^[0-9a-f]{12,40}$/.test(rawExpectedSha)) {
  console.error('CAPACITY_EXPECTED_SHA must be a 12..40 character hexadecimal Git SHA')
  process.exit(2)
}
const expectedVersion = rawExpectedSha ? rawExpectedSha.slice(0, 12) : null

const expectedBackendBinding = (process.env.CAPACITY_EXPECTED_BACKEND_BINDING || '')
  .trim()
  .toLowerCase()
if (!allowLocal && !/^[0-9a-f]{24}$/.test(expectedBackendBinding)) {
  console.error('CAPACITY_EXPECTED_BACKEND_BINDING must bind production probes to a 24 character backend fingerprint')
  process.exit(2)
}
if (expectedBackendBinding && !/^[0-9a-f]{24}$/.test(expectedBackendBinding)) {
  console.error('CAPACITY_EXPECTED_BACKEND_BINDING must be a 24 character hexadecimal backend fingerprint')
  process.exit(2)
}

function boundedInteger(name, fallback, min, max) {
  const value = Number.parseInt(process.env[name] || String(fallback), 10)
  if (!Number.isInteger(value) || value < min || value > max) {
    console.error(`${name} must be an integer from ${min} to ${max}`)
    process.exit(2)
  }
  return value
}

const concurrency = boundedInteger('CAPACITY_CONCURRENCY', 4, 1, 25)
const requestsPerPath = boundedInteger('CAPACITY_REQUESTS_PER_PATH', 20, 1, 250)
const maxP95Ms = boundedInteger('CAPACITY_MAX_P95_MS', 2500, 100, 30000)
const maxFailurePercent = boundedInteger('CAPACITY_MAX_FAILURE_PERCENT', 1, 0, 25)
const timeoutMs = boundedInteger('CAPACITY_REQUEST_TIMEOUT_MS', 8000, 1000, 30000)
const paths = ['/', '/api/health']

const results = []
let nextIndex = 0
const queue = paths.flatMap((path) => Array.from({ length: requestsPerPath }, () => path))

async function runOne(path) {
  const started = performance.now()
  try {
    const response = await fetch(new URL(path, baseUrl), {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'EntizNetStore-capacity-probe/1.0' },
    })
    const healthy = response.status === 200
    if (path === '/api/health') {
      const body = await response.json().catch(() => null)
      const elapsedMs = performance.now() - started
      const versionMatches = !expectedVersion || body?.version === expectedVersion
      const backendMatches =
        !expectedBackendBinding || body?.backendBinding === expectedBackendBinding
      const launchGateContractValid =
        ['configured', 'blocked'].includes(body?.launchGates?.uploadSafety) &&
        ['enabled', 'blocked'].includes(body?.launchGates?.indexing) &&
        ['configured', 'blocked'].includes(body?.launchGates?.storeChat) &&
        ['configured', 'blocked'].includes(body?.launchGates?.messageTranslation)

      let reason
      if (!versionMatches) reason = 'deployment_version_mismatch'
      else if (!backendMatches) reason = 'backend_binding_mismatch'
      else if (!launchGateContractValid) reason = 'launch_gate_contract_invalid'

      results.push({
        path,
        elapsedMs,
        ok:
          healthy &&
          body?.status === 'ok' &&
          versionMatches &&
          backendMatches &&
          launchGateContractValid,
        status: response.status,
        reason,
      })
      return
    }
    await response.body?.cancel().catch(() => undefined)
    results.push({ path, elapsedMs: performance.now() - started, ok: healthy, status: response.status })
  } catch (error) {
    results.push({
      path,
      elapsedMs: performance.now() - started,
      ok: false,
      status: 0,
      error: error instanceof Error ? error.name : 'request_failed',
    })
  }
}

async function worker() {
  while (true) {
    const index = nextIndex++
    if (index >= queue.length) return
    await runOne(queue[index])
  }
}

const suiteStarted = performance.now()
await Promise.all(Array.from({ length: concurrency }, () => worker()))
const durationMs = performance.now() - suiteStarted

function percentile(values, fraction) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]
}

const failures = results.filter((result) => !result.ok)
const latencies = results.map((result) => result.elapsedMs)
const failurePercent = results.length ? (failures.length / results.length) * 100 : 100
const p50Ms = percentile(latencies, 0.5)
const p95Ms = percentile(latencies, 0.95)
const p99Ms = percentile(latencies, 0.99)
const throughputRps = results.length / Math.max(durationMs / 1000, 0.001)

const summary = {
  origin: baseUrl.origin,
  expectedVersion,
  expectedBackendBinding: expectedBackendBinding || null,
  paths,
  concurrency,
  requests: results.length,
  failures: failures.length,
  failurePercent: Number(failurePercent.toFixed(2)),
  durationMs: Math.round(durationMs),
  throughputRps: Number(throughputRps.toFixed(2)),
  latencyMs: {
    p50: Math.round(p50Ms),
    p95: Math.round(p95Ms),
    p99: Math.round(p99Ms),
    max: Math.round(Math.max(...latencies, 0)),
  },
  thresholds: { maxP95Ms, maxFailurePercent },
}

console.log(JSON.stringify(summary, null, 2))

if (failurePercent > maxFailurePercent || p95Ms > maxP95Ms) {
  console.error('Production read-capacity probe FAILED its declared envelope')
  process.exit(1)
}

console.log('Production read-capacity probe passed its declared envelope')
