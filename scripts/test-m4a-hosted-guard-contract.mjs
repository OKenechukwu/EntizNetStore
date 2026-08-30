import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

process.stdout.write('Hosted M4A fail-closed guard contract passed\n')
