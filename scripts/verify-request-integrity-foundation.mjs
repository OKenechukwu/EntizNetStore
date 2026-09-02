import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []

function read(relativePath) {
  const absolute = path.join(root, relativePath)
  if (!fs.existsSync(absolute)) {
    failures.push(`missing request-integrity safety file: ${relativePath}`)
    return ''
  }
  return fs.readFileSync(absolute, 'utf8')
}

function requireFragments(relativePath, fragments) {
  const content = read(relativePath)
  for (const fragment of fragments) {
    if (!content.includes(fragment)) {
      failures.push(`${relativePath} lost request-integrity safety control: ${fragment}`)
    }
  }
  return content
}

requireFragments('package.json', [
  'test:request-integrity',
  'verify-request-integrity-foundation.mjs',
  'npm run test:request-integrity',
])

const policy = requireFragments('lib/security/requestIntegrity.ts', [
  'UNSAFE_API_METHODS',
  'REQUEST_INTEGRITY_EXEMPT_PATHS',
  '/api/integrations/entiznet/handoff',
  '/api/payments/webhook',
  '/api/payments/payout-webhook',
  'fetchSite === "cross-site"',
  'origin !== input.requestOrigin',
  'fetchSite === "same-site"',
  'same_site_without_origin',
])

if (policy.includes('startsWith(input.pathname)') || policy.includes('pathname.startsWith(exempt')) {
  failures.push('request-integrity exemptions must remain exact-path matches, not prefix matches')
}

const proxy = requireFragments('proxy.ts', [
  'evaluateRequestIntegrity',
  'request.headers.get("origin")',
  'request.headers.get("sec-fetch-site")',
  '{ error: "Forbidden" }',
  '"Cache-Control": "no-store, max-age=0"',
  'updateSupabaseSession(request)',
])

const guardIndex = proxy.indexOf('evaluateRequestIntegrity({')
const sessionIndex = proxy.indexOf('updateSupabaseSession(request)')
if (guardIndex < 0 || sessionIndex < 0 || guardIndex >= sessionIndex) {
  failures.push('proxy.ts must reject invalid browser mutations before Supabase session refresh')
}

requireFragments('tests/request-integrity.test.mts', [
  'cross-site browser mutations are rejected before route authentication',
  'an origin mismatch is rejected even without Fetch Metadata',
  'same-site browser mutations without an exact Origin proof are rejected',
  'non-browser mutations without browser provenance headers remain available to authenticated services',
  'cryptographically authenticated cross-site ingress uses exact path exemptions',
])

requireFragments('scripts/test-production-http-smoke.mjs', [
  'cross-site mutation request-integrity boundary',
  "Origin: 'https://csrf.invalid'",
  "'/api/buyer/profile'",
])

requireFragments('docs/operations/REQUEST_INTEGRITY.md', [
  'Origin',
  'Sec-Fetch-Site',
  'exact-path exemptions',
  'does not replace authorization or RLS',
])

if (failures.length) {
  console.error('Request-integrity foundation verification FAILED:\n')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Request-integrity foundation verification passed.')
