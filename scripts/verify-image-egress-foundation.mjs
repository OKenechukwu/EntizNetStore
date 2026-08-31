import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []

function read(relativePath) {
  const absolute = path.join(root, relativePath)
  if (!fs.existsSync(absolute)) {
    failures.push(`missing image-egress safety file: ${relativePath}`)
    return ''
  }
  return fs.readFileSync(absolute, 'utf8')
}

function requireFragments(relativePath, fragments) {
  const content = read(relativePath)
  for (const fragment of fragments) {
    if (!content.includes(fragment)) {
      failures.push(`${relativePath} lost image-egress safety control: ${fragment}`)
    }
  }
  return content
}

const nextConfig = requireFragments('next.config.js', [
  "PUBLIC_IMAGE_BUCKETS = ['product-media', 'seller-branding']",
  "pathname: `/storage/v1/object/public/${bucket}/**`",
  'remotePatterns: supabaseStorageBinding?.remotePatterns ?? []',
  'maximumRedirects: 0',
  'dangerouslyAllowLocalIP: false',
  'dangerouslyAllowSVG: false',
  "contentDispositionType: 'attachment'",
  "const imageSources = [\"'self'\", 'data:', 'blob:']",
  'imageSources.push(supabaseStorageBinding.origin)',
])

if (/hostname:\s*['"]\*\*['"]/.test(nextConfig)) {
  failures.push('next.config.js must never restore a wildcard image optimizer hostname')
}
if (/img-src[^;]*\bhttps:\s*(?:;|$)/.test(nextConfig)) {
  failures.push('next.config.js must not restore a bare https: browser image source')
}

requireFragments('lib/storage/publicMedia.ts', [
  "PUBLIC_IMAGE_BUCKETS = new Set(['product-media', 'seller-branding'])",
  'LOCAL_MEDIA_PREFIXES',
  'isTrustedPublicMediaSource',
  'trustedPublicMediaSource',
  "if (url.origin !== expectedOrigin) return false",
  "if (!url.pathname.startsWith(PUBLIC_STORAGE_PREFIX)) return false",
])

for (const [relativePath, requiredFragment] of [
  ['components/products/ProductCard.tsx', 'trustedPublicMediaSource'],
  ['components/product/ProductGallery.tsx', 'isTrustedPublicMediaSource'],
  ['components/products/ProductGallery.tsx', 'isTrustedPublicMediaSource'],
]) {
  requireFragments(relativePath, [requiredFragment])
}

requireFragments('tests/public-media-source.test.mts', [
  'accepts only canonical Supabase public image buckets',
  'rejects credential-bearing, malformed and traversal absolute URLs',
])
requireFragments('tests/image-egress-config.test.mjs', [
  'pins managed Supabase image optimization to approved public buckets',
  'fails closed for arbitrary, credential-bearing and malformed image origins',
])
requireFragments('scripts/test-image-optimizer-egress.mjs', [
  '/_next/image',
  'arbitrary HTTPS origin',
  'Supabase non-storage path',
  'private KYC bucket through public-object route',
])

requireFragments('package.json', [
  'test:public-media-source',
  'test:image-egress-config',
  'test:image-optimizer-egress',
  'verify-image-egress-foundation.mjs',
])
requireFragments('.github/workflows/ci.yml', [
  'Run public media source regression',
  'npm run test:public-media-source',
  'Run image egress configuration regression',
  'npm run test:image-egress-config',
])
requireFragments('.github/workflows/http-authorization.yml', [
  'Image optimizer egress regression failed; server log follows',
  'npm run test:image-optimizer-egress',
])
requireFragments('docs/operations/IMAGE_EGRESS_SECURITY.md', [
  'server-side fetch surface',
  'product-media',
  'seller-branding',
  'No wildcard hostnames',
])

if (failures.length) {
  console.error('Image-egress foundation verification FAILED:\n')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Image-egress foundation verification passed.')
