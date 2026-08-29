import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const CANONICAL_PRODUCTION_APP_ORIGIN = 'https://entiznetstore.vercel.app'
const CANONICAL_PRODUCTION_SUPABASE_ORIGIN = 'https://kllwwurklumhawfsilpd.supabase.co'

const rawOrigin = process.env.DEPLOYED_AUTH_BASE_URL
const supabaseUrl = process.env.DEPLOYED_AUTH_SUPABASE_URL
const anonKey = process.env.DEPLOYED_AUTH_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.DEPLOYED_AUTH_SUPABASE_SERVICE_ROLE_KEY
const configuredProductionSupabaseUrl = process.env.DEPLOYED_PRODUCTION_SUPABASE_URL || ''
const expectedCommit = process.env.DEPLOYED_AUTH_EXPECTED_COMMIT || ''
const environment = process.env.DEPLOYED_AUTH_TEST_ENVIRONMENT
const mutationConsent = process.env.DEPLOYED_AUTH_TEST_ALLOW_MUTATION

if (!rawOrigin || !supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    'DEPLOYED_AUTH_BASE_URL, DEPLOYED_AUTH_SUPABASE_URL, DEPLOYED_AUTH_SUPABASE_ANON_KEY and DEPLOYED_AUTH_SUPABASE_SERVICE_ROLE_KEY are required',
  )
}
if (!/^[0-9a-f]{40}$/i.test(expectedCommit)) {
  throw new Error('DEPLOYED_AUTH_EXPECTED_COMMIT must be an exact 40-character Git SHA')
}
if (!['preview', 'staging'].includes(environment || '')) {
  throw new Error('DEPLOYED_AUTH_TEST_ENVIRONMENT must be preview or staging; production is intentionally refused')
}
if (mutationConsent !== 'true') {
  throw new Error('DEPLOYED_AUTH_TEST_ALLOW_MUTATION=true is required because this gate creates disposable test identities')
}

const requestedOrigin = new URL(rawOrigin)
const origin = new URL(requestedOrigin.origin)
const targetSupabase = new URL(supabaseUrl)

if (requestedOrigin.protocol !== 'https:') throw new Error('deployed authorization target must use HTTPS')
if (requestedOrigin.username || requestedOrigin.password || requestedOrigin.search || requestedOrigin.hash) {
  throw new Error('deployed authorization target must be a clean deployment origin without credentials, query or hash')
}
if (requestedOrigin.pathname !== '/' && requestedOrigin.pathname !== '') {
  throw new Error('deployed authorization target must be an origin URL, not a path-scoped URL')
}
if (origin.origin === CANONICAL_PRODUCTION_APP_ORIGIN) {
  throw new Error('canonical production host is forbidden for deployed authorization fixtures')
}
if (targetSupabase.protocol !== 'https:') {
  throw new Error('deployed authorization Supabase target must use HTTPS')
}

const forbiddenSupabaseOrigins = new Set([CANONICAL_PRODUCTION_SUPABASE_ORIGIN])
if (configuredProductionSupabaseUrl) {
  forbiddenSupabaseOrigins.add(new URL(configuredProductionSupabaseUrl).origin)
}
if (forbiddenSupabaseOrigins.has(targetSupabase.origin)) {
  throw new Error('deployed authorization fixtures must use an isolated non-production Supabase project or branch')
}

const admin = createClient(targetSupabase.origin, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const createdUserIds = []
const cleanupFailures = []
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
const password = 'DeployedAuth-Regression-2026!'
const evidencePath = 'tmp/deployed-auth-evidence.json'
const evidence = {
  schemaVersion: 1,
  runId,
  environment,
  targetApplicationOrigin: origin.origin,
  targetSupabaseOrigin: targetSupabase.origin,
  expectedCommit,
  observedCommit: null,
  startedAt: new Date().toISOString(),
  completedAt: null,
  result: 'running',
  failure: null,
  checks: [],
  disposableIdentitiesCreated: 0,
  cleanup: {
    attemptedUsers: 0,
    deletedUsers: 0,
    verifiedApplicationTables: [],
    failures: [],
  },
}

function recordCheck(label, details = {}) {
  evidence.checks.push({ label, ...details })
}

function cookieHeader(cookieJar) {
  return [...cookieJar.entries()].map(([name, entry]) => `${name}=${entry.value}`).join('; ')
}

async function createIdentity(label, appMetadata = {}) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `deployed-auth-${label}-${runId}@example.test`,
    password,
    email_confirm: true,
    app_metadata: appMetadata,
  })
  if (error || !data.user) throw error || new Error(`unable to create ${label} identity`)
  createdUserIds.push(data.user.id)
  evidence.disposableIdentitiesCreated = createdUserIds.length

  const cookieJar = new Map()
  const authClient = createServerClient(targetSupabase.origin, anonKey, {
    cookies: {
      getAll() {
        return [...cookieJar.entries()].map(([name, entry]) => ({ name, value: entry.value }))
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieJar.set(name, { value, options: options || {} })
        })
      },
    },
  })

  const { error: signInError } = await authClient.auth.signInWithPassword({
    email: data.user.email,
    password,
  })
  if (signInError) throw signInError

  return { id: data.user.id, cookie: cookieHeader(cookieJar) }
}

async function appFetch(pathname, { cookie, method = 'GET', json } = {}) {
  const headers = new Headers({
    'User-Agent': 'EntizNetStore-deployed-auth-regression/1.0',
  })
  if (cookie) headers.set('cookie', cookie)
  if (json !== undefined) headers.set('content-type', 'application/json')

  return fetch(new URL(pathname, origin), {
    method,
    headers,
    body: json !== undefined ? JSON.stringify(json) : undefined,
    redirect: 'manual',
  })
}

async function expectStatus(label, response, expected) {
  const text = await response.clone().text().catch(() => '')
  assert.equal(
    response.status,
    expected,
    `${label}: expected HTTP ${expected}, received ${response.status}; body=${text.slice(0, 500)}`,
  )
  recordCheck(label, { type: 'http', expectedStatus: expected, observedStatus: response.status })
  process.stdout.write(`ok - ${label} -> ${expected}\n`)
  return text ? JSON.parse(text) : null
}

async function expectPage(label, pathname, cookie, expectedMarker) {
  const response = await appFetch(pathname, { cookie })
  assert.equal(response.status, 200, `${label}: expected HTTP 200, received ${response.status}`)
  const body = await response.text()
  assert.ok(
    body.includes(expectedMarker),
    `${label}: expected deployed page marker ${JSON.stringify(expectedMarker)} was not rendered`,
  )
  recordCheck(label, {
    type: 'protected-page',
    pathname,
    observedStatus: response.status,
    expectedMarker,
  })
  process.stdout.write(`ok - ${label} protected page -> 200 with route marker\n`)
}

async function removeRows(table, column, userId) {
  const { error } = await admin.from(table).delete().eq(column, userId)
  if (error) cleanupFailures.push(`${table}.${column}: ${error.message}`)
}

async function verifyNoRows(table, column, userId) {
  const { count, error } = await admin
    .from(table)
    .select('*', { head: true, count: 'exact' })
    .eq(column, userId)

  if (error) {
    cleanupFailures.push(`${table}.${column} verification: ${error.message}`)
    return
  }
  if ((count ?? 0) !== 0) {
    cleanupFailures.push(`${table}.${column} verification: expected 0 rows, found ${count}`)
    return
  }
  evidence.cleanup.verifiedApplicationTables.push(`${table}.${column}`)
}

async function cleanupIdentity(userId) {
  // These are exact disposable-user ownership/actor keys. The current gate only
  // creates onboarding/profile rows, but the extra user-scoped cleanup keeps the
  // fixture safe if a protected page later gains an audit/state side effect.
  await removeRows('marketplace_capability_state_events', 'actor_id', userId)
  await removeRows('marketplace_capability_state_events', 'user_id', userId)
  await removeRows('marketplace_capability_states', 'user_id', userId)
  await removeRows('entiznet_identity_links', 'store_user_id', userId)
  await removeRows('admin_audit_logs', 'admin_id', userId)
  await removeRows('marketplace_reports', 'reporter_user_id', userId)
  await removeRows('addresses', 'user_id', userId)
  await removeRows('notifications', 'user_id', userId)
  await removeRows('upload_scan_jobs', 'actor_id', userId)
  await removeRows('kyc_documents', 'seller_id', userId)
  await removeRows('kyc_verification_requests', 'seller_id', userId)
  await removeRows('profiles_business', 'id', userId)
  await removeRows('profiles_seller_private', 'seller_id', userId)
  await removeRows('profiles_seller', 'id', userId)
  await removeRows('profiles_buyer', 'id', userId)

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) cleanupFailures.push(`auth.users: ${error.message}`)
  else evidence.cleanup.deletedUsers += 1

  await verifyNoRows('profiles_business', 'id', userId)
  await verifyNoRows('profiles_seller_private', 'seller_id', userId)
  await verifyNoRows('profiles_seller', 'id', userId)
  await verifyNoRows('profiles_buyer', 'id', userId)
  await verifyNoRows('kyc_documents', 'seller_id', userId)
  await verifyNoRows('kyc_verification_requests', 'seller_id', userId)
  await verifyNoRows('marketplace_capability_states', 'user_id', userId)
  await verifyNoRows('entiznet_identity_links', 'store_user_id', userId)
}

async function persistEvidence() {
  evidence.completedAt = new Date().toISOString()
  evidence.cleanup.attemptedUsers = createdUserIds.length
  evidence.cleanup.failures = [...cleanupFailures]
  await mkdir('tmp', { recursive: true })
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
}

let testError = null
let evidenceWriteError = null

try {
  const health = await expectStatus('deployed health', await appFetch('/api/health'), 200)
  assert.equal(health?.status, 'ok')
  assert.deepEqual(health?.checks, { database: 'ok', storage: 'ok', operations: 'ok' })
  assert.equal(
    health?.version,
    expectedCommit.slice(0, 12),
    `deployed health version must match expected commit ${expectedCommit.slice(0, 12)}`,
  )
  evidence.observedCommit = health.version
  recordCheck('exact deployment commit matches', {
    type: 'commit',
    expected: expectedCommit.slice(0, 12),
    observed: health.version,
  })

  await expectStatus('anonymous capability lookup denied', await appFetch('/api/auth/capabilities'), 401)
  await expectStatus('anonymous Admin account search denied', await appFetch('/api/admin/accounts'), 401)

  const buyer = await createIdentity('buyer')
  const seller = await createIdentity('seller')
  const business = await createIdentity('business')
  const adminUser = await createIdentity('admin', { role: 'admin' })

  await expectStatus(
    'buyer canonical onboarding',
    await appFetch('/api/onboarding/buyer', {
      cookie: buyer.cookie,
      method: 'POST',
      json: { display_name: 'Deployed Auth Buyer' },
    }),
    200,
  )
  await expectStatus(
    'seller canonical onboarding',
    await appFetch('/api/onboarding/seller', {
      cookie: seller.cookie,
      method: 'POST',
      json: { storefront_name: 'Deployed Auth Seller', business_type: 'individual' },
    }),
    200,
  )
  await expectStatus(
    'Business/BSM canonical onboarding',
    await appFetch('/api/onboarding/business', {
      cookie: business.cookie,
      method: 'POST',
      json: { display_name: 'Deployed Auth Business', business_kind: 'brand' },
    }),
    200,
  )

  const buyerCaps = await expectStatus(
    'buyer capabilities resolve from deployed session',
    await appFetch('/api/auth/capabilities', { cookie: buyer.cookie }),
    200,
  )
  assert.equal(buyerCaps.userId, buyer.id)
  assert.equal(buyerCaps.isBuyer, true)
  assert.equal(buyerCaps.isSeller, false)
  assert.equal(buyerCaps.isBusiness, false)
  assert.equal(buyerCaps.isAdmin, false)

  const sellerCaps = await expectStatus(
    'seller capabilities resolve from deployed session',
    await appFetch('/api/auth/capabilities', { cookie: seller.cookie }),
    200,
  )
  assert.equal(sellerCaps.userId, seller.id)
  assert.equal(sellerCaps.isBuyer, true)
  assert.equal(sellerCaps.isSeller, true)
  assert.equal(sellerCaps.isBusiness, false)

  const businessCaps = await expectStatus(
    'Business/BSM capabilities resolve additively',
    await appFetch('/api/auth/capabilities', { cookie: business.cookie }),
    200,
  )
  assert.equal(businessCaps.userId, business.id)
  assert.equal(businessCaps.isBuyer, true)
  assert.equal(businessCaps.isSeller, true)
  assert.equal(businessCaps.isBusiness, true)

  const adminCaps = await expectStatus(
    'Admin authority resolves from trusted app metadata',
    await appFetch('/api/auth/capabilities', { cookie: adminUser.cookie }),
    200,
  )
  assert.equal(adminCaps.userId, adminUser.id)
  assert.equal(adminCaps.isAdmin, true)

  // The identities and cookies above are minted directly against the isolated
  // Supabase target. These successful deployed-session checks therefore prove
  // that the application deployment is wired to that same target rather than
  // to production or to a different project.
  recordCheck('deployed app and fixture Supabase target are session-compatible', {
    type: 'environment-binding',
    targetSupabaseOrigin: targetSupabase.origin,
  })

  await expectStatus(
    'buyer self-profile mutation succeeds',
    await appFetch('/api/buyer/profile', {
      cookie: buyer.cookie,
      method: 'PATCH',
      json: { display_name: 'Deployed Auth Buyer Updated', country: 'PH' },
    }),
    200,
  )
  await expectStatus(
    'buyer cannot mutate Seller storefront',
    await appFetch('/api/seller/storefront', {
      cookie: buyer.cookie,
      method: 'PATCH',
      json: { storefrontName: 'Unauthorized Storefront' },
    }),
    403,
  )
  await expectStatus(
    'seller can mutate own storefront',
    await appFetch('/api/seller/storefront', {
      cookie: seller.cookie,
      method: 'PATCH',
      json: { storefrontName: 'Deployed Auth Seller Updated', bio: 'Disposable deployed-auth fixture.' },
    }),
    200,
  )

  await expectStatus(
    'ordinary buyer cannot use Admin account search',
    await appFetch('/api/admin/accounts', { cookie: buyer.cookie }),
    403,
  )
  await expectStatus(
    'trusted Admin can use Admin account search',
    await appFetch('/api/admin/accounts', { cookie: adminUser.cookie }),
    200,
  )

  // Client-authenticated dashboards intentionally server-render a loading shell
  // before AuthProvider hydration. Server-authenticated BSM/Admin dashboards
  // must render their trusted role-specific content immediately. Route-specific
  // markers avoid false positives from generic Next.js framework/RSC payloads.
  await expectPage('Buyer dashboard', '/dashboard/buyer', buyer.cookie, 'Loading profile...')
  await expectPage('Seller dashboard', '/dashboard/seller', seller.cookie, 'Loading your dashboard...')
  await expectPage('Business/BSM dashboard', '/dashboard/bsm', business.cookie, 'Business / BSM')
  await expectPage('Admin dashboard', '/admin', adminUser.cookie, 'EntizNetStore Operations')

  evidence.result = 'passed'
  process.stdout.write(`Deployed authenticated authorization regression passed for ${origin.origin}\n`)
} catch (error) {
  testError = error
  evidence.result = 'failed'
  evidence.failure = error instanceof Error ? error.message : String(error)
} finally {
  for (const userId of [...createdUserIds].reverse()) {
    await cleanupIdentity(userId)
  }

  if (cleanupFailures.length) evidence.result = 'failed'

  try {
    await persistEvidence()
  } catch (error) {
    evidenceWriteError = error
  }
}

if (cleanupFailures.length) {
  const originalFailure = testError
    ? `; original test failure: ${testError instanceof Error ? testError.message : String(testError)}`
    : ''
  throw new Error(`deployed-auth fixture cleanup failed: ${cleanupFailures.join('; ')}${originalFailure}`)
}
if (evidenceWriteError) throw evidenceWriteError
if (testError) throw testError