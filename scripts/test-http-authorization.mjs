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
const createdUserIds = []
const password = 'HttpRegression-Only-2026!'
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=',
  'base64',
)

function cookieHeader(cookieJar) {
  return [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
}

async function createUser(label, appMetadata = {}) {
  const email = `http-${label}-${runId}@example.test`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: appMetadata,
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
  return { id: data.user.id, email, cookie: cookieHeader(cookieJar) }
}

async function appFetch(path, { cookie, method = 'GET', json, body, headers = {} } = {}) {
  const requestHeaders = new Headers(headers)
  if (cookie) requestHeaders.set('cookie', cookie)
  if (json !== undefined) requestHeaders.set('content-type', 'application/json')
  return fetch(`${origin}${path}`, {
    method,
    headers: requestHeaders,
    body: json !== undefined ? JSON.stringify(json) : body,
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

function productPayload() {
  return {
    title: 'HTTP authorization product',
    description: 'CI-only authorization fixture.',
    shortDescription: 'CI fixture',
    productType: 'physical',
    basePrice: 25,
    compareAtPrice: null,
    costPerItem: null,
    brandId: null,
    categoryIds: [],
    mediaUrls: [],
    variants: [{
      title: 'Default', option1: '', option2: '', option3: '',
      sku: `HTTP-${runId}`.slice(0, 100), barcode: '', price: 25,
      compareAtPrice: null, costPerItem: null, trackInventory: true,
      inventoryQuantity: 5, inventoryPolicy: 'deny', weightGrams: 100,
      requiresShipping: true, isActive: true,
    }],
    trackInventory: true,
    continueSelling: false,
    requiresShipping: true,
    isTaxable: true,
    weightGrams: 100,
    material: '',
    ageRestriction: 18,
    tags: ['ci-regression'],
    searchKeywords: ['ci-regression'],
  }
}

try {
  const buyer = await createUser('buyer')
  const sellerA = await createUser('seller-a')
  const sellerB = await createUser('seller-b')
  const adminUser = await createUser('admin', { role: 'admin' })

  await expectStatus('anonymous capability lookup denied', await appFetch('/api/auth/capabilities'), 401)
  await expectStatus(
    'buyer onboarding is self-scoped',
    await appFetch('/api/onboarding/buyer', {
      cookie: buyer.cookie,
      method: 'POST',
      json: { display_name: 'HTTP Buyer', id: sellerA.id },
    }),
    200,
  )
  await expectStatus(
    'seller A onboarding',
    await appFetch('/api/onboarding/seller', {
      cookie: sellerA.cookie,
      method: 'POST',
      json: { storefront_name: 'HTTP Seller A', business_type: 'individual' },
    }),
    200,
  )
  await expectStatus(
    'seller B onboarding',
    await appFetch('/api/onboarding/seller', {
      cookie: sellerB.cookie,
      method: 'POST',
      json: { storefront_name: 'HTTP Seller B', business_type: 'individual' },
    }),
    200,
  )

  await expectStatus(
    'buyer self-profile update',
    await appFetch('/api/buyer/profile', {
      cookie: buyer.cookie,
      method: 'PATCH',
      json: { display_name: 'HTTP Buyer Updated', country: 'PH', interests: ['marketplace'] },
    }),
    200,
  )
  await expectStatus(
    'anonymous buyer profile mutation denied',
    await appFetch('/api/buyer/profile', { method: 'PATCH', json: { display_name: 'Nope' } }),
    401,
  )

  await expectStatus(
    'buyer cannot mutate Seller storefront',
    await appFetch('/api/seller/storefront', {
      cookie: buyer.cookie,
      method: 'PATCH',
      json: { storefrontName: 'Buyer Store' },
    }),
    403,
  )
  const storefrontUpdate = await expectStatus(
    'seller storefront update is authenticated-self scoped',
    await appFetch('/api/seller/storefront', {
      cookie: sellerA.cookie,
      method: 'PATCH',
      json: {
        storefrontName: 'HTTP Seller A Updated',
        bio: 'Seller A only',
        shippingPolicy: 'Ships safely.',
        returnPolicy: 'Returns safely.',
        id: sellerB.id,
      },
    }),
    200,
  )
  assert.equal(storefrontUpdate.storefront.storefront_name, 'HTTP Seller A Updated')

  await expectStatus(
    'buyer cannot create Seller product',
    await appFetch('/api/seller/products', {
      cookie: buyer.cookie,
      method: 'POST',
      json: productPayload(),
    }),
    403,
  )
  const createdProduct = await expectStatus(
    'seller A can create owned product',
    await appFetch('/api/seller/products', {
      cookie: sellerA.cookie,
      method: 'POST',
      json: productPayload(),
    }),
    201,
  )
  assert.match(createdProduct.id, /^[0-9a-f-]{36}$/i)
  await expectStatus(
    'seller B cannot delete seller A product',
    await appFetch(`/api/seller/products/${createdProduct.id}`, {
      cookie: sellerB.cookie,
      method: 'DELETE',
    }),
    404,
  )

  // Storefront conversations require a verified active seller. Verification is
  // changed directly only inside this disposable authorization fixture.
  const { error: verifySellerError } = await admin
    .from('profiles_seller')
    .update({ verification_status: 'verified', updated_at: new Date().toISOString() })
    .eq('id', sellerA.id)
  if (verifySellerError) throw verifySellerError

  await expectStatus(
    'legacy plaintext chat sender is retired',
    await appFetch('/api/chat/send', {
      cookie: buyer.cookie,
      method: 'POST',
      json: { text: 'legacy', threadId: crypto.randomUUID(), recipientId: sellerA.id },
    }),
    410,
  )
  await expectStatus(
    'recipient-addressed canonical send is rejected',
    await appFetch('/api/messages/send', {
      cookie: buyer.cookie,
      method: 'POST',
      json: { recipientId: sellerA.id, content: 'must not send', messageType: 'text' },
    }),
    400,
  )

  const opened = await expectStatus(
    'buyer opens verified storefront conversation',
    await appFetch('/api/chat/start', {
      cookie: buyer.cookie,
      method: 'POST',
      json: { contextType: 'storefront', contextId: sellerA.id },
    }),
    200,
  )
  assert.match(opened.conversationId, /^[0-9a-f-]{36}$/i)

  await expectStatus(
    'unrelated seller cannot read canonical conversation',
    await appFetch(`/api/messages/conversations/${opened.conversationId}`, {
      cookie: sellerB.cookie,
    }),
    404,
  )

  const originalMessage = 'HTTP canonical encrypted authorization message'
  const sent = await expectStatus(
    'buyer can send through canonical conversation authority',
    await appFetch('/api/messages/send', {
      cookie: buyer.cookie,
      method: 'POST',
      json: { conversationId: opened.conversationId, content: originalMessage, messageType: 'text' },
    }),
    200,
  )
  const messageId = sent.message.id
  assert.match(messageId, /^[0-9a-f-]{36}$/i)

  const { data: storedMessage, error: storedMessageError } = await admin
    .from('messages')
    .select('id, sender_id, recipient_id, conversation_id, content, is_encrypted, encryption_version, conversation_key_id')
    .eq('id', messageId)
    .single()
  if (storedMessageError) throw storedMessageError
  assert.equal(storedMessage.sender_id, buyer.id)
  assert.equal(storedMessage.recipient_id, sellerA.id)
  assert.equal(storedMessage.conversation_id, opened.conversationId)
  assert.equal(storedMessage.is_encrypted, true)
  assert.equal(storedMessage.encryption_version, 'msg-aes-256-gcm-v1')
  assert.equal(storedMessage.conversation_key_id, null)
  assert.notEqual(storedMessage.content, originalMessage)
  assert.equal(storedMessage.content.includes(originalMessage), false)

  const { data: envelope, error: envelopeError } = await admin
    .from('message_key_envelopes')
    .select('conversation_id, wrapped_key, wrap_iv, kek_id, key_wrap_version')
    .eq('conversation_id', opened.conversationId)
    .single()
  if (envelopeError) throw envelopeError
  assert.equal(envelope.key_wrap_version, 'kek-aes-256-gcm-v1')
  assert.ok(envelope.wrapped_key.length >= 40)
  assert.ok(envelope.wrap_iv.length >= 16)
  assert.ok(envelope.kek_id.length >= 3)

  const buyerList = await expectStatus(
    'buyer lists canonical conversations without Auth email identity',
    await appFetch('/api/messages/conversations', { cookie: buyer.cookie }),
    200,
  )
  const buyerConversation = buyerList.conversations.find((conversation) => conversation.id === opened.conversationId)
  assert.ok(buyerConversation)
  assert.equal(buyerConversation.counterpart.id, sellerA.id)
  assert.equal(buyerConversation.counterpart.displayName, 'HTTP Seller A Updated')
  assert.equal('email' in buyerConversation.counterpart, false)
  assert.equal(JSON.stringify(buyerConversation).includes(sellerA.email), false)
  assert.equal(buyerConversation.lastMessage.content, originalMessage)

  const sellerDetail = await expectStatus(
    'conversation participant receives decrypted canonical original',
    await appFetch(`/api/messages/conversations/${opened.conversationId}`, {
      cookie: sellerA.cookie,
    }),
    200,
  )
  assert.equal(sellerDetail.messages.length, 1)
  assert.equal(sellerDetail.messages[0].content, originalMessage)
  assert.equal(sellerDetail.messages[0].senderId, buyer.id)

  await expectStatus(
    'legacy user-UUID conversation reader is retired',
    await appFetch(`/api/messages/conversation/${sellerA.id}`, { cookie: buyer.cookie }),
    410,
  )

  const senderUpload = new FormData()
  senderUpload.set('messageId', messageId)
  senderUpload.set('file', new File([onePixelPng], 'sender.png', { type: 'image/png' }))
  const attachmentResult = await expectStatus(
    'message sender can attach scanned media to canonical conversation',
    await appFetch('/api/messages/attachments/upload', {
      cookie: buyer.cookie,
      method: 'POST',
      body: senderUpload,
    }),
    201,
  )
  const attachmentId = attachmentResult.attachment.id

  await expectStatus(
    'unrelated seller cannot download canonical message attachment',
    await appFetch(`/api/messages/attachments/download?id=${encodeURIComponent(attachmentId)}`, {
      cookie: sellerB.cookie,
    }),
    404,
  )
  await expectStatus(
    'conversation recipient can receive signed attachment URL',
    await appFetch(`/api/messages/attachments/download?id=${encodeURIComponent(attachmentId)}`, {
      cookie: sellerA.cookie,
    }),
    200,
  )

  await expectStatus('anonymous Admin account search denied', await appFetch('/api/admin/accounts'), 401)
  await expectStatus(
    'ordinary buyer cannot use Admin account search',
    await appFetch('/api/admin/accounts', { cookie: buyer.cookie }),
    403,
  )
  await expectStatus(
    'trusted app-metadata Admin can use Admin account search',
    await appFetch('/api/admin/accounts', { cookie: adminUser.cookie }),
    200,
  )
  await expectStatus(
    'unsigned EntizNet Admin integration is fail-closed',
    await appFetch('/api/integrations/entiznet/admin/accounts'),
    401,
  )

  await expectStatus(
    'seller A can delete own product',
    await appFetch(`/api/seller/products/${createdProduct.id}`, {
      cookie: sellerA.cookie,
      method: 'DELETE',
    }),
    200,
  )

  process.stdout.write('HTTP authorization regression suite passed\n')
} finally {
  if (createdUserIds.length) {
    const { data: messageRows } = await admin
      .from('messages')
      .select('id')
      .or(createdUserIds.map((id) => `sender_id.eq.${id}`).join(','))
    const messageIds = (messageRows || []).map((row) => row.id)
    if (messageIds.length) {
      const { data: attachmentRows } = await admin
        .from('message_attachments')
        .select('file_path')
        .in('message_id', messageIds)
      const paths = (attachmentRows || []).map((row) => row.file_path).filter(Boolean)
      if (paths.length) await admin.storage.from('message-attachments').remove(paths)
      await admin.from('message_attachments').delete().in('message_id', messageIds)
    }

    await admin.from('notifications').delete().in('user_id', createdUserIds)
    await admin.from('messages').delete().in('sender_id', createdUserIds)
    await admin.from('messages').delete().in('recipient_id', createdUserIds)
    const { data: conversations } = await admin
      .from('conversations')
      .select('id')
      .or(createdUserIds.map((id) => `participant1_id.eq.${id},participant2_id.eq.${id}`).join(','))
    const conversationIds = (conversations || []).map((row) => row.id)
    if (conversationIds.length) {
      await admin.from('message_key_envelopes').delete().in('conversation_id', conversationIds)
      await admin.from('conversations').delete().in('id', conversationIds)
    }
  }

  for (const userId of createdUserIds.reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) process.stderr.write(`warning: unable to delete CI auth user ${userId}: ${error.message}\n`)
  }
}
