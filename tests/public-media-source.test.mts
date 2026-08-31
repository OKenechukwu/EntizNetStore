import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isTrustedPublicMediaSource,
  trustedPublicMediaSource,
} from '../lib/storage/publicMedia.ts'

const managedSupabase = 'https://abc123.supabase.co'
const productImage = `${managedSupabase}/storage/v1/object/public/product-media/seller-1/product-1/image.webp`
const brandingImage = `${managedSupabase}/storage/v1/object/public/seller-branding/seller-1/logo/logo.webp`

test('accepts approved local media namespaces', () => {
  for (const source of [
    '/attached_assets/stock_images/product.jpg',
    '/images/catalog/product.webp',
    '/logos/entiznetstore.png',
    '/favicons/icon-192.png',
    '/demo/hero/slide1.jpg',
  ]) {
    assert.equal(isTrustedPublicMediaSource(source, managedSupabase), true, source)
  }
})

test('rejects protocol-relative, route-like and traversal local sources', () => {
  for (const source of [
    '//evil.example/image.png',
    '/api/health',
    '/auth/session',
    '/images/../api/health',
    '/images/%2e%2e/api/health',
    '/images/%5c..%5capi/health',
  ]) {
    assert.equal(isTrustedPublicMediaSource(source, managedSupabase), false, source)
  }
})

test('accepts only canonical Supabase public image buckets', () => {
  assert.equal(isTrustedPublicMediaSource(productImage, managedSupabase), true)
  assert.equal(isTrustedPublicMediaSource(brandingImage, managedSupabase), true)

  for (const source of [
    'https://evil.example/storage/v1/object/public/product-media/x/image.webp',
    `${managedSupabase}/auth/v1/health`,
    `${managedSupabase}/storage/v1/object/sign/product-media/x/image.webp`,
    `${managedSupabase}/storage/v1/object/public/kyc-documents/x/passport.webp`,
    `${managedSupabase}/storage/v1/object/public/message-attachments/x/message.webp`,
    `${managedSupabase}/storage/v1/object/public/product-media/`,
  ]) {
    assert.equal(isTrustedPublicMediaSource(source, managedSupabase), false, source)
  }
})

test('rejects credential-bearing, malformed and traversal absolute URLs', () => {
  for (const source of [
    'https://user:password@abc123.supabase.co/storage/v1/object/public/product-media/x/image.webp',
    `${managedSupabase}/storage/v1/object/public/product-media/x/%2e%2e/secret.webp`,
    `${managedSupabase}/storage/v1/object/public/product-media/x/%00image.webp`,
    'javascript:alert(1)',
    'not-a-url',
  ]) {
    assert.equal(isTrustedPublicMediaSource(source, managedSupabase), false, source)
  }
})

test('uses a safe local fallback instead of persisting untrusted image egress', () => {
  const fallback = '/attached_assets/stock_images/fallback.jpg'
  assert.equal(trustedPublicMediaSource(productImage, fallback, managedSupabase), productImage)
  assert.equal(
    trustedPublicMediaSource('https://evil.example/tracker.png', fallback, managedSupabase),
    fallback,
  )
  assert.equal(trustedPublicMediaSource(null, fallback, managedSupabase), fallback)
})
