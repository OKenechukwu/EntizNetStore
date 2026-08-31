const PUBLIC_STORAGE_PREFIX = '/storage/v1/object/public/'
const PUBLIC_IMAGE_BUCKETS = new Set(['product-media', 'seller-branding'])
const LOCAL_MEDIA_PREFIXES = ['/attached_assets/', '/images/', '/logos/', '/favicons/', '/demo/'] as const

function configuredSupabaseOrigin(supabaseUrl: string | undefined) {
  if (!supabaseUrl) return null
  try {
    const url = new URL(supabaseUrl)
    if (url.username || url.password) return null
    return url.origin
  } catch {
    return null
  }
}

function hasUnsafePathEncoding(value: string) {
  return /(?:^|\/)(?:\.{1,2}|%2e(?:%2e)?)(?:\/|%2f|$)/i.test(value) || /%5c|%00/i.test(value)
}

function hasUnsafeDecodedPath(pathname: string) {
  try {
    const decoded = decodeURIComponent(pathname)
    if (decoded.includes('\\') || decoded.includes('\0')) return true
    return decoded.split('/').some((segment) => segment === '.' || segment === '..')
  } catch {
    return true
  }
}

function isApprovedLocalMediaPath(candidate: string) {
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return false
  if (candidate.includes('\\') || candidate.includes('\0') || hasUnsafePathEncoding(candidate)) return false
  return LOCAL_MEDIA_PREFIXES.some((prefix) => candidate.startsWith(prefix))
}

export function isTrustedPublicMediaSource(
  value: string | null | undefined,
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
) {
  if (!value) return false
  const candidate = value.trim()
  if (!candidate) return false

  if (candidate.startsWith('/')) return isApprovedLocalMediaPath(candidate)

  const expectedOrigin = configuredSupabaseOrigin(supabaseUrl)
  if (!expectedOrigin || hasUnsafePathEncoding(candidate)) return false

  try {
    const url = new URL(candidate)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
    if (url.username || url.password) return false
    if (url.origin !== expectedOrigin) return false
    if (!url.pathname.startsWith(PUBLIC_STORAGE_PREFIX)) return false

    const storagePath = url.pathname.slice(PUBLIC_STORAGE_PREFIX.length)
    if (hasUnsafeDecodedPath(storagePath)) return false
    const slash = storagePath.indexOf('/')
    if (slash <= 0 || slash === storagePath.length - 1) return false
    const bucket = storagePath.slice(0, slash)
    if (!PUBLIC_IMAGE_BUCKETS.has(bucket)) return false

    return true
  } catch {
    return false
  }
}

export function trustedPublicMediaSource(
  value: string | null | undefined,
  fallback: string,
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
) {
  return isTrustedPublicMediaSource(value, supabaseUrl) ? value!.trim() : fallback
}
