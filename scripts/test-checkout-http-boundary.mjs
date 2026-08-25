import assert from 'node:assert/strict'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const origin = process.env.APP_ORIGIN || 'http://127.0.0.1:3000'
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error('SUPABASE_URL, SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required')
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const password = 'CheckoutBoundary-Only-2026!'
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`

function cookieHeader(cookieJar) {
  return [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
}

async function createUser(label) {
  const email = `checkout-${label}-${runId}@example.test`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) throw error || new Error(`Unable to create ${label}`)

  const cookieJar = new Map()
  const authClient = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      get(name) { return cookieJar.get(name) },
      set(name, value) { cookieJar.set(name, value) },
      remove(name) { cookieJar.delete(name) },
    },
  })
  const { error: signInError } = await authClient.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError
  return { id: data.user.id, cookie: cookieHeader(cookieJar) }
}

async function appFetch(path, { cookie, method = 'GET', json } = {}) {
  const headers = new Headers()
  if (cookie) headers.set('cookie', cookie)
  if (json !== undefined) headers.set('content-type', 'application/json')
  return fetch(`${origin}${path}`, {
    method,
    headers,
    body: json !== undefined ? JSON.stringify(json) : undefined,
    redirect: 'manual',
  })
}

async function expectJson(label, response, expectedStatus) {
  const text = await response.text()
  assert.equal(
    response.status,
    expectedStatus,
    `${label}: expected HTTP ${expectedStatus}, got ${response.status}; body=${text.slice(0, 800)}`,
  )
  const payload = text ? JSON.parse(text) : null
  process.stdout.write(`ok - ${label} -> ${expectedStatus}\n`)
  return payload
}

function productPayload() {
  return {
    title: 'Checkout address boundary product',
    description: 'CI-only product for the authenticated checkout boundary regression.',
    shortDescription: 'CI checkout product',
    productType: 'physical',
    basePrice: 25,
    compareAtPrice: null,
    costPerItem: null,
    brandId: null,
    categoryIds: [],
    mediaUrls: [],
    variants: [{
      title: 'Default',
      option1: '',
      option2: '',
      option3: '',
      sku: `CHECKOUT-${runId}`.slice(0, 100),
      barcode: '',
      price: 25,
      compareAtPrice: null,
      costPerItem: null,
      trackInventory: true,
      inventoryQuantity: 5,
      inventoryPolicy: 'deny',
      weightGrams: 100,
      requiresShipping: true,
      isActive: true,
    }],
    trackInventory: true,
    continueSelling: false,
    requiresShipping: true,
    isTaxable: true,
    weightGrams: 100,
    material: '',
    ageRestriction: 18,
    tags: ['ci-checkout-boundary'],
    searchKeywords: ['ci-checkout-boundary'],
  }
}

function addressPayload(type, label) {
  return {
    nickname: label,
    isDefault: false,
    type,
    firstName: 'Checkout',
    lastName: 'Regression',
    company: null,
    addressLine1: '1 Test Street',
    addressLine2: null,
    city: 'Baguio',
    stateProvince: 'Benguet',
    postalCode: '2600',
    country: 'PH',
    phone: null,
  }
}

const buyer = await createUser('buyer')
const otherBuyer = await createUser('other-buyer')
const seller = await createUser('seller')

await expectJson(
  'checkout buyer onboarding',
  await appFetch('/api/onboarding/buyer', { cookie: buyer.cookie, method: 'POST', json: {} }),
  200,
)
await expectJson(
  'other checkout buyer onboarding',
  await appFetch('/api/onboarding/buyer', { cookie: otherBuyer.cookie, method: 'POST', json: {} }),
  200,
)
await expectJson(
  'checkout seller onboarding',
  await appFetch('/api/onboarding/seller', {
    cookie: seller.cookie,
    method: 'POST',
    json: { storefront_name: 'Checkout Boundary Seller', business_type: 'individual' },
  }),
  200,
)

const product = await expectJson(
  'checkout seller creates CI product',
  await appFetch('/api/seller/products', {
    cookie: seller.cookie,
    method: 'POST',
    json: productPayload(),
  }),
  201,
)
assert.match(product.id, /^[0-9a-f-]{36}$/i)

const { data: variant, error: variantError } = await admin
  .from('product_variants')
  .select('id')
  .eq('product_id', product.id)
  .limit(1)
  .single()
if (variantError || !variant) throw variantError || new Error('CI product variant missing')

const { data: cart, error: cartError } = await admin
  .from('carts')
  .insert({ buyer_id: buyer.id, status: 'active', currency: 'usd', version: 1 })
  .select('id')
  .single()
if (cartError || !cart) throw cartError || new Error('Unable to seed checkout cart')

const { error: cartItemError } = await admin.from('cart_items').insert({
  cart_id: cart.id,
  product_id: product.id,
  variant_id: variant.id,
  quantity: 1,
})
if (cartItemError) throw cartItemError

const billing = await expectJson(
  'buyer saves billing-only address',
  await appFetch('/api/buyer/addresses', {
    cookie: buyer.cookie,
    method: 'POST',
    json: addressPayload('billing', 'Billing only'),
  }),
  200,
)
const shipping = await expectJson(
  'buyer saves shipping address',
  await appFetch('/api/buyer/addresses', {
    cookie: buyer.cookie,
    method: 'POST',
    json: addressPayload('shipping', 'Shipping'),
  }),
  200,
)
const foreignShipping = await expectJson(
  'other buyer saves shipping address',
  await appFetch('/api/buyer/addresses', {
    cookie: otherBuyer.cookie,
    method: 'POST',
    json: addressPayload('shipping', 'Other buyer shipping'),
  }),
  200,
)

await expectJson(
  'anonymous quote denied',
  await appFetch('/api/cart/quote', { method: 'POST', json: { addressId: shipping.addressId } }),
  401,
)

const billingRejected = await expectJson(
  'billing-only address rejected as shipping quote address',
  await appFetch('/api/cart/quote', {
    cookie: buyer.cookie,
    method: 'POST',
    json: { addressId: billing.addressId },
  }),
  404,
)
assert.equal(billingRejected.error, 'Shipping address not found')

const foreignRejected = await expectJson(
  'another buyer shipping address rejected',
  await appFetch('/api/cart/quote', {
    cookie: buyer.cookie,
    method: 'POST',
    json: { addressId: foreignShipping.addressId },
  }),
  404,
)
assert.equal(foreignRejected.error, 'Shipping address not found')

const accepted = await expectJson(
  'owned shipping address accepted by quote boundary',
  await appFetch('/api/cart/quote', {
    cookie: buyer.cookie,
    method: 'POST',
    json: { addressId: shipping.addressId },
  }),
  200,
)
assert.equal(accepted.quote.shipping_address.addressId, shipping.addressId)
assert.equal(accepted.quote.status, 'blocked')
assert.equal(accepted.quote.block_reasons.includes('shipping_quote_provider_unconfigured'), true)
assert.equal(accepted.quote.block_reasons.includes('tax_quote_provider_unconfigured'), true)

process.stdout.write('Authenticated checkout HTTP boundary regression passed\n')
