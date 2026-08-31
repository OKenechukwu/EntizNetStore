import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const supabaseUrl = process.env.SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error('SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required')
}

const email = `product-media-rpc-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`
const password = 'ProductMediaRpc-CI-Only-2026!'
let userId = null

async function jsonFetch(url, { method = 'GET', key, bearer = key, body, prefer } = {}) {
  const headers = new Headers()
  if (key) headers.set('apikey', key)
  if (bearer) headers.set('authorization', `Bearer ${bearer}`)
  if (body !== undefined) headers.set('content-type', 'application/json')
  if (prefer) headers.set('prefer', prefer)

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let json = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = { raw: text }
    }
  }
  return { response, json, text }
}

async function serviceInsert(table, body) {
  const result = await jsonFetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: 'POST',
    key: serviceRoleKey,
    body,
    prefer: 'return=minimal',
  })
  assert.ok(
    result.response.ok,
    `service fixture insert into ${table} failed: HTTP ${result.response.status}; body=${result.text.slice(0, 800)}`,
  )
}

try {
  const create = await jsonFetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    key: serviceRoleKey,
    body: {
      email,
      password,
      email_confirm: true,
    },
  })
  assert.equal(create.response.status, 200, `unable to create HTTP provenance fixture user: ${create.text}`)
  userId = create.json?.id
  assert.ok(userId, 'admin user create response did not include an id')

  await serviceInsert('profiles_buyer', {
    id: userId,
    display_name: 'Product Media Direct RPC HTTP Seller',
  })
  await serviceInsert('profiles_seller', {
    id: userId,
    storefront_name: 'Product Media Direct RPC HTTP Store',
    business_type: 'individual',
    verification_status: 'verified',
    shipping_policy: 'Tracked shipping for the isolated HTTP provenance regression.',
    return_policy: 'Returns accepted under the isolated HTTP provenance regression policy.',
  })

  const signIn = await jsonFetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    key: anonKey,
    bearer: anonKey,
    body: { email, password },
  })
  assert.equal(signIn.response.status, 200, `fixture sign-in failed: ${signIn.text}`)
  const accessToken = signIn.json?.access_token
  assert.ok(accessToken, 'fixture sign-in did not return an access token')

  const maliciousMedia = `https://evil.example/storage/v1/object/public/product-media/${userId}/${randomUUID()}.webp`
  const rpc = await jsonFetch(`${supabaseUrl}/rest/v1/rpc/seller_save_product_v3`, {
    method: 'POST',
    key: anonKey,
    bearer: accessToken,
    body: {
      p_product_id: null,
      p_title: 'Direct PostgREST media bypass attempt',
      p_description: 'CI-only direct RPC request that must never persist an arbitrary external media URL.',
      p_short_description: 'CI direct RPC bypass attempt',
      p_product_type: 'physical',
      p_base_price: 25,
      p_compare_at_price: null,
      p_cost_per_item: null,
      p_brand_id: null,
      p_category_ids: [],
      p_media_urls: [maliciousMedia],
      p_variants: [
        {
          title: 'Default',
          sku: 'MEDIA-RPC-HTTP-CI',
          price: 25,
          trackInventory: true,
          inventoryQuantity: 1,
          inventoryPolicy: 'deny',
          requiresShipping: true,
          isActive: true,
        },
      ],
      p_track_inventory: true,
      p_continue_selling: false,
      p_requires_shipping: true,
      p_is_taxable: true,
      p_weight_grams: 100,
      p_material: null,
      p_age_restriction: 18,
      p_tags: ['ci-provenance'],
      p_search_keywords: ['ci-provenance'],
    },
  })

  assert.equal(
    rpc.response.ok,
    false,
    `authenticated direct PostgREST RPC unexpectedly accepted arbitrary product media: ${rpc.text}`,
  )
  assert.match(
    rpc.text,
    /product_media_url_not_canonical/,
    `direct PostgREST RPC failed for the wrong reason: HTTP ${rpc.response.status}; body=${rpc.text.slice(0, 1000)}`,
  )

  const rows = await jsonFetch(
    `${supabaseUrl}/rest/v1/products?select=id&title=eq.${encodeURIComponent('Direct PostgREST media bypass attempt')}`,
    { key: serviceRoleKey },
  )
  assert.ok(rows.response.ok, `unable to inspect bypass rollback: ${rows.text}`)
  assert.deepEqual(rows.json, [], 'failed direct RPC left a partial product row behind')

  process.stdout.write('ok - authenticated direct PostgREST product-media bypass rejected atomically\n')
} finally {
  if (userId) {
    await jsonFetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      key: serviceRoleKey,
    }).catch(() => undefined)
  }
}
