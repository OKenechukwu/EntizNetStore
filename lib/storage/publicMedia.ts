const PUBLIC_STORAGE_PREFIX = '/storage/v1/object/public/'

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

function hasUnsafeDecodedPath(pathname: string) {
  try {
    const decoded = decodeURIComponent(pathname)
    if (decoded.includes('\\') || decoded.includes('\0')) return true
    return decoded.split('/').some((segment) => segment === '.' || segment === '..')
  } catch {
    return true
  }
}

export function isTrustedPublicMediaSource(
  value: string | null | undefined,
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
) {
  if (!value) return false
  const candidate = value.trim()
  if (!candidate) return false

  if (candidate.startsWith('/')) {
    return !candidate.startsWith('//') && !candidate.includes('\\') && !candidate.includes('\0')
  }

  const expectedOrigin = configuredSupabaseOrigin(supabaseUrl)
  if (!expectedOrigin) return false

  try {
    const url = new URL(candidate)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
    if (url.username || url.password) return false
    if (url.origin !== expectedOrigin) return false
    if (!url.pathname.startsWith(PUBLIC_STORAGE_PREFIX)) return false
    if (hasUnsafeDecodedPath(url.pathname.slice(PUBLIC_STORAGE_PREFIX.length))) return false
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
