import assert from 'node:assert/strict'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const origin = process.env.APP_ORIGIN || 'http://127.0.0.1:3000'
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error('M4A HTTP regression requires Supabase URL, anon key and service-role key')
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const password = 'M4A-Http-Regression-2026!'
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
const createdUserIds = []
let productId = null

function cookieHeader(cookieJar) {
  return [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
}

async function createUser(label) {
  const email = `m4a-http-${label}-${runId}@example.test`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) throw error || new Error(`Unable to create ${label}`)
  createdUserIds.push(data.user.id)

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
    body: json === undefined ? undefined : JSON.stringify(json),
    redirect: 'manual',
  })
}

async function expectStatus(label, response, expected) {
  const text = await response.clone().text().catch(() => '')
  assert.equal(
    response.status,
    expected,
    `${label}: expected HTTP ${expected}, received ${response.status}; body=${text.slice(0, 800)}`,
  )
  process.stdout.write(`ok - ${label} -> ${expected}\n`)
  return text ? JSON.parse(text) : null
}

async function seedMarketplace({ seller, businessBuyer, retailBuyer, otherBusiness }) {
  const buyerRows = [seller, businessBuyer, retailBuyer, otherBusiness].map((user, index) => ({
    id: user.id,
    display_name: `M4A HTTP Buyer ${index + 1}`,
  }))
  const { error: buyerError } = await admin.from('profiles_buyer').insert(buyerRows)
  if (buyerError) throw buyerError

  const { error: sellerError } = await admin.from('profiles_seller').insert([
    {
      id: seller.id,
      storefront_name: 'M4A HTTP Supplier',
      business_type: 'business',
      verification_status: 'verified',
      return_policy: 'HTTP regression returns policy.',
      shipping_policy: 'HTTP regression shipping policy.',
    },
    {
      id: otherBusiness.id,
      storefront_name: 'M4A HTTP Other Business',
      business_type: 'business',
      verification_status: 'verified',
      return_policy: 'HTTP regression returns policy.',
      shipping_policy: 'HTTP regression shipping policy.',
    },
  ])
  if (sellerError) throw sellerError

  const { error: businessError } = await admin.from('profiles_business').insert([
    { id: seller.id, display_name: 'M4A HTTP Supplier Ltd', business_kind: 'supplier', country: 'PH', verification_status: 'verified' },
    { id: businessBuyer.id, display_name: 'M4A HTTP Retailer Ltd', business_kind: 'retailer', country: 'PH', verification_status: 'verified' },
    { id: otherBusiness.id, display_name: 'M4A HTTP Distributor Ltd', business_kind: 'distributor', country: 'PH', verification_status: 'verified' },
  ])
  if (businessError) throw businessError

  const { data: category, error: categoryError } = await admin
    .from('categories')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .single()
  if (categoryError || !category) throw categoryError || new Error('No active category for M4A fixture')

  const { data: product, error: productError } = await admin
    .from('products')
    .insert({
      seller_id: seller.id,
      title: 'M4A HTTP Wholesale Product',
      slug: `m4a-http-wholesale-${runId}`.slice(0, 190),
      description: 'Disposable M4A HTTP wholesale regression product.',
      type: 'physical',
      status: 'draft',
      moderation_status: 'not_submitted',
      base_price: 30,
      requires_shipping: false,
      is_taxable: false,
      marketplace_brand: 'entiznetstore',
    })
    .select('id')
    .single()
  if (productError || !product) throw productError || new Error('Unable to create M4A product')
  productId = product.id

  const { data: variant, error: variantError } = await admin
    .from('product_variants')
    .insert({
      product_id: product.id,
      title: 'Case Unit',
      sku: `M4A-HTTP-${runId}`.slice(0, 100),
      price: 30,
      track_inventory: true,
      inventory_quantity: 1000,
      inventory_policy: 'deny',
      requires_shipping: false,
      is_active: true,
      position: 0,
    })
    .select('id')
    .single()
  if (variantError || !variant) throw variantError || new Error('Unable to create M4A variant')

  const [{ error: categoryLinkError }, { error: mediaError }] = await Promise.all([
    admin.from('product_categories').insert({ product_id: product.id, category_id: category.id }),
    admin.from('product_media').insert({
      product_id: product.id,
      variant_id: variant.id,
      type: 'image',
      url: 'https://example.invalid/m4a-http-wholesale.jpg',
      alt_text: 'M4A HTTP wholesale fixture',
      position: 0,
    }),
  ])
  if (categoryLinkError) throw categoryLinkError
  if (mediaError) throw mediaError

  const { error: activationError } = await admin
    .from('products')
    .update({ moderation_status: 'approved', status: 'active', moderated_at: new Date().toISOString() })
    .eq('id', product.id)
  if (activationError) throw activationError

  return { productId: product.id, variantId: variant.id }
}

// MOQ and order multiple intentionally do not divide evenly. The contract is
// MOQ + n*multiple, so 12, 17, 22, ... are valid quantities while 15 is not.
function offerPayload(productIdValue, variantIdValue, offerId = null, status = 'active') {
  return {
    offerId,
    productId: productIdValue,
    variantId: variantIdValue,
    status,
    minimumOrderQuantity: 12,
    orderMultiple: 5,
    unitLabel: 'unit',
    casePackSize: 10,
    leadTimeDays: 7,
    incoterm: 'FOB',
    startsAt: null,
    endsAt: null,
    tiers: [
      { minimumQuantity: 12, unitPriceCents: 2000 },
      { minimumQuantity: 52, unitPriceCents: 1800 },
      { minimumQuantity: 102, unitPriceCents: 1600 },
    ],
  }
}

try {
  const seller = await createUser('seller')
  const businessBuyer = await createUser('business-buyer')
  const retailBuyer = await createUser('retail-buyer')
  const otherBusiness = await createUser('other-business')
  const fixture = await seedMarketplace({ seller, businessBuyer, retailBuyer, otherBusiness })

  await expectStatus('anonymous trading-role read denied', await appFetch('/api/bsm/trading-roles'), 401)
  await expectStatus('anonymous wholesale offer read denied', await appFetch('/api/bsm/wholesale/offers'), 401)
  await expectStatus('anonymous wholesale catalogue denied', await appFetch('/api/bsm/wholesale/catalog'), 401)
  await expectStatus(
    'anonymous wholesale cart mutation denied',
    await appFetch('/api/cart/wholesale', { method: 'POST', json: { offerId: crypto.randomUUID(), quantity: 52 } }),
    401,
  )

  const roles = await expectStatus(
    'verified BSM can set additive trading roles',
    await appFetch('/api/bsm/trading-roles', {
      cookie: seller.cookie,
      method: 'PUT',
      json: { roles: ['manufacturer', 'distributor', 'wholesaler'] },
    }),
    200,
  )
  assert.deepEqual(roles.roles, ['manufacturer', 'distributor', 'wholesaler'])

  await expectStatus(
    'ordinary Buyer cannot publish wholesale offer',
    await appFetch('/api/bsm/wholesale/offers', {
      cookie: retailBuyer.cookie,
      method: 'POST',
      json: offerPayload(fixture.productId, fixture.variantId),
    }),
    403,
  )

  const created = await expectStatus(
    'verified BSM can publish owned wholesale offer',
    await appFetch('/api/bsm/wholesale/offers', {
      cookie: seller.cookie,
      method: 'POST',
      json: offerPayload(fixture.productId, fixture.variantId),
    }),
    201,
  )
  assert.match(created.offerId, /^[0-9a-f-]{36}$/i)

  const ordinaryCatalogue = await expectStatus(
    'ordinary Buyer wholesale catalogue request does not leak B2B offers',
    await appFetch('/api/bsm/wholesale/catalog', { cookie: retailBuyer.cookie }),
    200,
  )
  assert.deepEqual(ordinaryCatalogue.offers, [])
  assert.equal(JSON.stringify(ordinaryCatalogue).includes('unitPriceCents'), false)

  const businessCatalogue = await expectStatus(
    'verified Business buyer can read eligible wholesale catalogue',
    await appFetch('/api/bsm/wholesale/catalog', { cookie: businessBuyer.cookie }),
    200,
  )
  const visibleOffer = businessCatalogue.offers.find((offer) => offer.id === created.offerId)
  assert.ok(visibleOffer, 'verified Business buyer could not see the published wholesale offer')
  assert.equal(visibleOffer.minimumOrderQuantity, 12)
  assert.equal(visibleOffer.orderMultiple, 5)
  assert.deepEqual(visibleOffer.tiers.map((tier) => tier.unitPriceCents), [2000, 1800, 1600])

  await expectStatus(
    'ordinary Buyer cannot place wholesale cart line',
    await appFetch('/api/cart/wholesale', {
      cookie: retailBuyer.cookie,
      method: 'POST',
      json: { offerId: created.offerId, quantity: 52 },
    }),
    403,
  )
  await expectStatus(
    'verified Business buyer cannot bypass MOQ',
    await appFetch('/api/cart/wholesale', {
      cookie: businessBuyer.cookie,
      method: 'POST',
      json: { offerId: created.offerId, quantity: 7 },
    }),
    400,
  )
  await expectStatus(
    'verified Business buyer cannot bypass MOQ-relative order multiple',
    await appFetch('/api/cart/wholesale', {
      cookie: businessBuyer.cookie,
      method: 'POST',
      json: { offerId: created.offerId, quantity: 15 },
    }),
    400,
  )

  const wholesaleCart = await expectStatus(
    'verified Business buyer can add MOQ-relative wholesale line',
    await appFetch('/api/cart/wholesale', {
      cookie: businessBuyer.cookie,
      method: 'POST',
      json: { offerId: created.offerId, quantity: 52 },
    }),
    200,
  )
  const wholesaleLine = wholesaleCart.cart.items.find((item) => item.id === wholesaleCart.itemId)
  assert.ok(wholesaleLine, 'wholesale line missing from canonical cart response')
  assert.equal(wholesaleLine.purchaseMode, 'wholesale')
  assert.equal(wholesaleLine.wholesaleTerms.offerId, created.offerId)
  assert.equal(wholesaleLine.wholesaleTerms.minimumOrderQuantity, 12)
  assert.equal(wholesaleLine.wholesaleTerms.orderMultiple, 5)
  assert.equal(wholesaleLine.wholesaleTerms.tierMinimumQuantity, 52)
  assert.equal(wholesaleLine.unitPriceCents, 1800)
  assert.equal(wholesaleLine.quantity, 52)

  await expectStatus(
    'cross-BSM wholesale offer edit denied',
    await appFetch('/api/bsm/wholesale/offers', {
      cookie: otherBusiness.cookie,
      method: 'POST',
      json: offerPayload(fixture.productId, fixture.variantId, created.offerId, 'paused'),
    }),
    403,
  )

  await expectStatus(
    'owner BSM can pause wholesale offer',
    await appFetch('/api/bsm/wholesale/offers', {
      cookie: seller.cookie,
      method: 'POST',
      json: offerPayload(fixture.productId, fixture.variantId, created.offerId, 'paused'),
    }),
    200,
  )

  const pausedCart = await expectStatus(
    'paused offer invalidates existing wholesale cart line',
    await appFetch('/api/cart', { cookie: businessBuyer.cookie }),
    200,
  )
  const pausedLine = pausedCart.cart.items.find((item) => item.id === wholesaleCart.itemId)
  assert.ok(pausedLine, 'paused wholesale line disappeared instead of remaining explainably unavailable')
  assert.equal(pausedLine.purchaseMode, 'wholesale')
  assert.equal(pausedLine.available, false)
  assert.equal(pausedLine.availabilityReason, 'wholesale_offer_unavailable')
  assert.equal(pausedLine.wholesaleTerms, null)
  assert.equal(pausedLine.unitPriceCents, 0)
  assert.equal(pausedLine.lineTotalCents, 0)

  const pausedCatalogue = await expectStatus(
    'paused offer disappears from Business sourcing catalogue',
    await appFetch('/api/bsm/wholesale/catalog', { cookie: businessBuyer.cookie }),
    200,
  )
  assert.equal(pausedCatalogue.offers.some((offer) => offer.id === created.offerId), false)

  process.stdout.write('M4A HTTP authorization regression passed\n')
} finally {
  if (productId) {
    try {
      await admin.from('products').delete().eq('id', productId)
    } catch {
      // The local database is disposable; cleanup is best-effort after assertions.
    }
  }
  for (const id of createdUserIds.reverse()) {
    try {
      await admin.auth.admin.deleteUser(id)
    } catch {
      // Keep teardown from masking the security assertion that actually failed.
    }
  }
}
