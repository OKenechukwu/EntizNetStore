import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const configPath = require.resolve('../next.config.js')
const originalPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const originalServerUrl = process.env.SUPABASE_URL
const originalNodeEnv = process.env.NODE_ENV

function setOrDelete(name, value) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

function loadConfig({ publicUrl, serverUrl, nodeEnv = 'production' } = {}) {
  setOrDelete('NEXT_PUBLIC_SUPABASE_URL', publicUrl)
  setOrDelete('SUPABASE_URL', serverUrl)
  setOrDelete('NODE_ENV', nodeEnv)
  delete require.cache[configPath]
  return require(configPath)
}

async function cspFor(config) {
  const rules = await config.headers()
  const globalRule = rules.find((rule) => rule.source === '/:path*')
  return globalRule?.headers?.find((header) => header.key === 'Content-Security-Policy')?.value ?? ''
}

function directive(csp, name) {
  return csp
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `)) ?? ''
}

test.after(() => {
  setOrDelete('NEXT_PUBLIC_SUPABASE_URL', originalPublicUrl)
  setOrDelete('SUPABASE_URL', originalServerUrl)
  setOrDelete('NODE_ENV', originalNodeEnv)
  delete require.cache[configPath]
})

test('pins managed Supabase image optimization to approved public buckets', async () => {
  const config = loadConfig({ publicUrl: 'https://abc123.supabase.co' })
  assert.deepEqual(config.images.remotePatterns, [
    {
      protocol: 'https',
      hostname: 'abc123.supabase.co',
      port: '',
      pathname: '/storage/v1/object/public/product-media/**',
    },
    {
      protocol: 'https',
      hostname: 'abc123.supabase.co',
      port: '',
      pathname: '/storage/v1/object/public/seller-branding/**',
    },
  ])
  assert.equal(config.images.maximumRedirects, 0)
  assert.equal(config.images.dangerouslyAllowLocalIP, false)
  assert.equal(config.images.dangerouslyAllowSVG, false)
  assert.equal(config.images.contentDispositionType, 'attachment')

  const imgSrc = directive(await cspFor(config), 'img-src')
  assert.match(imgSrc, /https:\/\/abc123\.supabase\.co/)
  assert.doesNotMatch(imgSrc, /(?:^|\s)https:(?:\s|$)/)
})

test('supports the isolated loopback Supabase stack without opening arbitrary local IPs', () => {
  const config = loadConfig({ publicUrl: 'http://127.0.0.1:54321' })
  assert.equal(config.images.remotePatterns.length, 2)
  for (const pattern of config.images.remotePatterns) {
    assert.equal(pattern.protocol, 'http')
    assert.equal(pattern.hostname, '127.0.0.1')
    assert.equal(pattern.port, '54321')
  }
  assert.equal(config.images.dangerouslyAllowLocalIP, false)
})

test('fails closed for arbitrary, credential-bearing and malformed image origins', async () => {
  for (const publicUrl of [
    'https://example.com',
    'http://10.0.0.8:54321',
    'https://user:password@abc123.supabase.co',
    'not-a-url',
  ]) {
    const config = loadConfig({ publicUrl })
    assert.deepEqual(config.images.remotePatterns, [], publicUrl)
    const imgSrc = directive(await cspFor(config), 'img-src')
    assert.doesNotMatch(imgSrc, /(?:^|\s)https:(?:\s|$)/, publicUrl)
    assert.doesNotMatch(imgSrc, /example\.com|10\.0\.0\.8|abc123\.supabase\.co/, publicUrl)
  }
})

test('can use the server Supabase URL only when no browser binding exists', () => {
  const config = loadConfig({ publicUrl: undefined, serverUrl: 'https://serverref.supabase.co' })
  assert.equal(config.images.remotePatterns.length, 2)
  assert.equal(config.images.remotePatterns[0].hostname, 'serverref.supabase.co')
})
