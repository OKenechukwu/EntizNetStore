import assert from 'node:assert/strict'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const rawOrigin = process.env.DEPLOYED_AUTH_BASE_URL
const supabaseUrl = process.env.DEPLOYED_AUTH_SUPABASE_URL
const anonKey = process.env.DEPLOYED_AUTH_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.DEPLOYED_AUTH_SUPABASE_SERVICE_ROLE_KEY
const productionSupabaseUrl = process.env.DEPLOYED_PRODUCTION_SUPABASE_URL
const expectedCommit = process.env.DEPLOYED_AUTH_EXPECTED_COMMIT || ''
const environment = process.env.DEPLOYED_AUTH_TEST_ENVIRONMENT
const mutationConsent = process.env.DEPLOYED_AUTH_TEST_ALLOW_MUTATION

if (!rawOrigin || !supabaseUrl || !anonKey || !serviceRoleKey || !productionSupabaseUrl) {
  throw new Error(
    'DEPLOYED_AUTH_BASE_URL, DEPLOYED_AUTH_SUPABASE_URL, DEPLOYED_AUTH_SUPABASE_ANON_KEY, DEPLOYED_AUTH_SUPABASE_SERVICE_ROLE_KEY and DEPLOYED_PRODUCTION_SUPABASE_URL are required',
  )
}

if (!['preview', 'staging'].includes(environment || '')) {
  throw new Error('DEPLOYED_AUTH_TEST_ENVIRONMENT must be preview or staging; production is intentionally refused')
}
if (mutationConsent !== 'true') {
  throw new Error('DEPLOYED_AUTH_TEST_ALLOW_MUTATION=true is required because this gate creates disposable test identities')
}

const origin = new URL(rawOrigin)
const targetSupabase = new URL(supabaseUrl)
const productionSupabase = new URL(productionSupabaseUrl)

if (origin.protocol !== 'https:') throw new Error('deployed authorization target must use HTTPS')
if (origin.hostname === 'entiznetstore.vercel.app') {
  throw new Error('canonical production host is forbidden for deployed authorization fixtures')
}
if (targetSupabase.origin === productionSupabase.origin) {
  throw new Error('deployed authorization fixtures must use an isolated non-production Supabase project')
}

const admin = createClient(targetSupabase.origin, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const createdUserIds = []
const cleanupFailures = []
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
const password = 'DeployedAuth-Regression-2026!'

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
  process.stdout.write(`ok - ${label} -> ${expected}\n`)
  return text ? JSON.parse(text) : null
}

async function expectPage(label, pathname, cookie) {
  const response = await appFetch(pathname, { cookie })
  assert.equal(response.status, 200, `${label}: expected HTTP 200, received ${response.status}`)
  const body = await response.text()
  assert.doesNotMatch(body, /Internal Server Error|Application error|This page could not be found/i)
  process.stdout.write(`ok - ${label} protected page -> 200\n`)
}

async function removeRows(table, column, userId) {
  const { error } = await admin.from(table).delete().eq(column, userId)
  if (error) cleanupFailures.push(`${table}: ${error.message}`)
}

async function cleanupIdentity(userId) {
  // Only tables populated by the onboarding calls below are touched. Keep the
  // fixture deliberately narrow so cleanup is deterministic and auditable.
  await removeRows('kyc_verification_requests', 'seller_id', userId)
  await removeRows('profiles_business', 'id', userId)
  await removeRows('profiles_seller_private', 'seller_id', userId)
  await removeRows('profiles_seller', 'id', userId)
  await removeRows('profiles_buyer', 'id', userId)

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) cleanupFailures.push(`auth.users: ${error.message}`)
}

try {
  const health = await expectStatus('deployed health', await appFetch('/api/health'), 200)
  assert.equal(health?.status, 'ok')
  assert.deepEqual(health?.checks, { database: 'ok', storage: 'ok', operations: 'ok' })
  if (expectedCommit) {
    assert.equal(
      health?.version,
      expectedCommit.slice(0, 12),
      `deployed health version must match expected commit ${expectedCommit.slice(0, 12)}`,
    )
  }

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

  await expectPage('Buyer dashboard', '/dashboard/buyer', buyer.cookie)
  await expectPage('Seller dashboard', '/seller/dashboard', seller.cookie)
  await expectPage('Business/BSM dashboard', '/dashboard/bsm', business.cookie)
  await expectPage('Admin dashboard', '/admin', adminUser.cookie)

  process.stdout.write(`Deployed authenticated authorization regression passed for ${origin.origin}\n`)
} finally {
  for (const userId of [...createdUserIds].reverse()) {
    await cleanupIdentity(userId)
  }

  if (cleanupFailures.length) {
    throw new Error(`deployed-auth fixture cleanup failed: ${cleanupFailures.join('; ')}`)
  }
}
