import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PUBLIC_LAUNCH_CONFIRMATION_VALUE,
  publicIndexingAllowed,
  publicIndexingLaunchStatus,
  publicRobotsRules,
  shouldNeverIndexPath,
  shouldSendNoIndex,
} from '../lib/launch/publicIndexing.ts'

function env(values: {
  SITE_INDEXING_ENABLED?: string
  PUBLIC_LAUNCH_CONFIRMATION?: string
  VERCEL_ENV?: string
}) {
  return values
}

test('public indexing is blocked by default and by any single launch switch', () => {
  assert.equal(publicIndexingAllowed(env({})), false)
  assert.equal(publicIndexingAllowed(env({ SITE_INDEXING_ENABLED: 'true' })), false)
  assert.equal(
    publicIndexingAllowed(env({ PUBLIC_LAUNCH_CONFIRMATION: PUBLIC_LAUNCH_CONFIRMATION_VALUE })),
    false,
  )
  assert.equal(publicIndexingLaunchStatus(env({})), 'blocked')
})

test('preview and development can never become indexable through copied launch flags', () => {
  const flags = {
    SITE_INDEXING_ENABLED: 'true',
    PUBLIC_LAUNCH_CONFIRMATION: PUBLIC_LAUNCH_CONFIRMATION_VALUE,
  }

  assert.equal(publicIndexingAllowed(env({ ...flags, VERCEL_ENV: 'preview' })), false)
  assert.equal(publicIndexingAllowed(env({ ...flags, VERCEL_ENV: 'development' })), false)
  assert.equal(publicIndexingAllowed(env({ ...flags })), false)
})

test('indexing requires exact case-sensitive production confirmation', () => {
  assert.equal(
    publicIndexingAllowed(
      env({
        VERCEL_ENV: 'production',
        SITE_INDEXING_ENABLED: 'true',
        PUBLIC_LAUNCH_CONFIRMATION: PUBLIC_LAUNCH_CONFIRMATION_VALUE,
      }),
    ),
    true,
  )
  assert.equal(
    publicIndexingAllowed(
      env({
        VERCEL_ENV: 'production',
        SITE_INDEXING_ENABLED: 'TRUE',
        PUBLIC_LAUNCH_CONFIRMATION: PUBLIC_LAUNCH_CONFIRMATION_VALUE,
      }),
    ),
    false,
  )
  assert.equal(
    publicIndexingAllowed(
      env({
        VERCEL_ENV: 'production',
        SITE_INDEXING_ENABLED: 'true',
        PUBLIC_LAUNCH_CONFIRMATION: 'entiznetstore_public_web_v1',
      }),
    ),
    false,
  )
})

test('sensitive/private route families remain non-indexable after public launch', () => {
  for (const pathname of [
    '/api/health',
    '/admin',
    '/admin/orders/123',
    '/dashboard',
    '/dashboard/buyer/orders',
    '/auth/sign-in',
    '/checkout',
    '/cart',
    '/wishlist',
    '/messages',
    '/notifications',
    '/seller/dashboard',
    '/internal/diagnostics',
  ]) {
    assert.equal(shouldNeverIndexPath(pathname), true, pathname)
  }

  for (const pathname of [
    '/',
    '/products/widget',
    '/categories/gifts',
    '/store/example',
    '/seller/apply',
    '/administrator',
    '/cartography',
  ]) {
    assert.equal(shouldNeverIndexPath(pathname), false, pathname)
  }
})

test('noindex decision combines launch state with sensitive route policy', () => {
  const launched = env({
    VERCEL_ENV: 'production',
    SITE_INDEXING_ENABLED: 'true',
    PUBLIC_LAUNCH_CONFIRMATION: PUBLIC_LAUNCH_CONFIRMATION_VALUE,
  })

  assert.equal(shouldSendNoIndex('/products/widget', launched), false)
  assert.equal(shouldSendNoIndex('/admin/orders', launched), true)
  assert.equal(shouldSendNoIndex('/products/widget', env({ VERCEL_ENV: 'production' })), true)
})

test('robots blocks the entire site before launch and excludes private route families after launch', () => {
  assert.deepEqual(publicRobotsRules(env({})), [{ userAgent: '*', disallow: '/' }])

  const launched = env({
    VERCEL_ENV: 'production',
    SITE_INDEXING_ENABLED: 'true',
    PUBLIC_LAUNCH_CONFIRMATION: PUBLIC_LAUNCH_CONFIRMATION_VALUE,
  })
  const rules = publicRobotsRules(launched)
  assert.equal(rules.length, 1)
  assert.equal(rules[0]?.userAgent, '*')
  assert.equal(rules[0]?.allow, '/')
  assert.ok(Array.isArray(rules[0]?.disallow))
  assert.ok(rules[0]?.disallow.includes('/api/'))
  assert.ok(rules[0]?.disallow.includes('/admin/'))
  assert.ok(rules[0]?.disallow.includes('/checkout/'))
})
