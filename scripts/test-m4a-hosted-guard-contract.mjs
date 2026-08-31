import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CANONICAL_PRODUCTION_SUPABASE_ORIGIN,
  createHostedAppFetch,
  fingerprintSupabaseOrigin,
  preflightHostedM4A,
} from './m4a-hosted-safety.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = path.join(root, 'scripts', 'test-m4a-hosted-http.mjs')
const exactSha = 'a'.repeat(40)
const isolatedSupabase = 'https://m4a-isolated-example.supabase.co'
const isolatedApp = 'https://m4a-isolated.example.test'

function runRefusal(label, overrides, expectedMessage) {
  const env = {
    PATH: process.env.PATH || '',
    HOME: process.env.HOME || '',
    APP_ORIGIN: isolatedApp,
    SUPABASE_URL: isolatedSupabase,
    NEXT_PUBLIC_SUPABASE_URL: isolatedSupabase,
    SUPABASE_ANON_KEY: 'guard-contract-anon-placeholder',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'guard-contract-anon-placeholder',
    SUPABASE_SERVICE_ROLE_KEY: 'guard-contract-service-role-placeholder',
    M4A_EXPECTED_COMMIT_SHA: exactSha,
    M4A_HTTP_TEST_ENVIRONMENT: 'preview',
    M4A_HTTP_ALLOW_REMOTE_MUTATION: 'true',
    ...overrides,
  }

  for (const [key, value] of Object.entries(env)) {
    if (value === null) delete env[key]
  }

  const result = spawnSync(process.execPath, [target], {
    cwd: root,
    env,
    encoding: 'utf8',
    timeout: 10_000,
  })
  const output = `${result.stdout || ''}\n${result.stderr || ''}`

  assert.notEqual(result.status, 0, `${label}: unsafe hosted target was not refused`)
  assert.match(output, expectedMessage, `${label}: refusal reason was not fail-closed and specific`)
  process.stdout.write(`ok - hosted M4A guard refuses ${label}\n`)
}

runRefusal(
  'canonical production application host',
  { APP_ORIGIN: 'https://entiznetstore.vercel.app' },
  /canonical production EntizNetStore host is forbidden/i,
)

runRefusal(
  'canonical production Supabase',
  { SUPABASE_URL: 'https://kllwwurklumhawfsilpd.supabase.co' },
  /must use an isolated non-production Supabase/i,
)

runRefusal(
  'production test environment',
  { M4A_HTTP_TEST_ENVIRONMENT: 'production' },
  /must be preview or staging/i,
)

runRefusal(
  'missing remote mutation consent',
  { M4A_HTTP_ALLOW_REMOTE_MUTATION: null },
  /M4A_HTTP_ALLOW_REMOTE_MUTATION=true is required/i,
)

runRefusal(
  'non-exact Git SHA',
  { M4A_EXPECTED_COMMIT_SHA: 'deadbeef' },
  /must be an exact 40-character Git SHA/i,
)

runRefusal(
  'path-scoped application target',
  { APP_ORIGIN: 'https://m4a-isolated.example.test/not-an-origin' },
  /must be an origin URL, not a path-scoped URL/i,
)

runRefusal(
  'protected Vercel target without bypass',
  { APP_ORIGIN: 'https://m4a-isolated-preview.vercel.app', VERCEL_AUTOMATION_BYPASS_SECRET: null },
  /VERCEL_AUTOMATION_BYPASS_SECRET is required/i,
)

const preflightTarget = {
  appOrigin: new URL(isolatedApp),
  supabaseOrigin: new URL(isolatedSupabase),
  expectedCommit: exactSha,
  environment: 'preview',
  vercelBypassSecret: '',
  expectedBackendBinding: fingerprintSupabaseOrigin(isolatedSupabase),
}

function healthResponse(backendBinding) {
  return new Response(
    JSON.stringify({
      status: 'ok',
      service: 'entiznetstore',
      version: exactSha.slice(0, 12),
      backendBinding,
      checks: { database: 'ok', storage: 'ok', operations: 'ok' },
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'content-security-policy': `default-src 'self'; connect-src 'self' ${isolatedSupabase}`,
      },
    },
  )
}

await assert.rejects(
  () =>
    preflightHostedM4A(
      preflightTarget,
      async () => healthResponse(fingerprintSupabaseOrigin(CANONICAL_PRODUCTION_SUPABASE_ORIGIN)),
    ),
  /server backend binding does not match/i,
  'hosted M4A preflight accepted a healthy-looking deployment bound server-side to the wrong Supabase origin',
)
process.stdout.write('ok - hosted M4A preflight refuses server/client Supabase binding confusion\n')

await preflightHostedM4A(
  preflightTarget,
  async () => healthResponse(preflightTarget.expectedBackendBinding),
)
process.stdout.write('ok - hosted M4A preflight accepts matching isolated browser + server binding\n')

const forwarded = []
const secretScopedTarget = { ...preflightTarget, vercelBypassSecret: 'guard-contract-bypass-secret' }
const guardedFetch = createHostedAppFetch(secretScopedTarget, async (input, init) => {
  forwarded.push({ url: String(input), headers: new Headers(init?.headers) })
  return new Response(null, { status: 204 })
})

await guardedFetch(`${isolatedApp}/api/health`)
await guardedFetch(`${isolatedSupabase}/rest/v1/profiles_buyer`)

assert.equal(
  forwarded[0].headers.get('x-vercel-protection-bypass'),
  'guard-contract-bypass-secret',
  'hosted app request did not receive the Vercel protection bypass header',
)
assert.equal(
  forwarded[0].headers.has('x-vercel-set-bypass-cookie'),
  false,
  'hosted verification unnecessarily requested a persistent Vercel bypass cookie',
)
assert.equal(
  forwarded[1].headers.has('x-vercel-protection-bypass'),
  false,
  'Vercel bypass credential leaked to the isolated Supabase origin',
)
process.stdout.write('ok - hosted M4A bypass stays origin-scoped and cookie-free\n')

process.stdout.write('Hosted M4A fail-closed guard contract passed\n')
