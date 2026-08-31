/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === 'production'

function trustedSupabaseStorageBinding() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  if (!rawUrl) return null

  try {
    const url = new URL(rawUrl)
    if (url.username || url.password) return null

    const isManagedSupabase =
      url.protocol === 'https:' && /^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname)
    const isLoopbackSupabase =
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname.toLowerCase())

    if (!isManagedSupabase && !isLoopbackSupabase) return null

    return {
      origin: url.origin,
      remotePattern: {
        protocol: url.protocol.slice(0, -1),
        hostname: url.hostname,
        port: url.port,
        pathname: '/storage/v1/object/public/**',
      },
    }
  } catch {
    return null
  }
}

const supabaseStorageBinding = trustedSupabaseStorageBinding()

const scriptSources = ["'self'", "'unsafe-inline'"]
if (!isProduction) scriptSources.push("'unsafe-eval'")

const imageSources = ["'self'", 'data:', 'blob:']
if (supabaseStorageBinding?.origin) imageSources.push(supabaseStorageBinding.origin)

const connectSources = ["'self'", 'wss:', 'https:']
try {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl) {
    const url = new URL(supabaseUrl)
    connectSources.push(url.origin)
    const socketProtocol = url.protocol === 'https:' ? 'wss:' : url.protocol === 'http:' ? 'ws:' : null
    if (socketProtocol) connectSources.push(`${socketProtocol}//${url.host}`)
  }
} catch {
  // Environment validation remains responsible for malformed service URLs.
  // CSP falls back to the restrictive production defaults above.
}

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src ${scriptSources.join(' ')}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `img-src ${Array.from(new Set(imageSources)).join(' ')}`,
  "font-src 'self' https://fonts.gstatic.com",
  `connect-src ${Array.from(new Set(connectSources)).join(' ')}`,
  "media-src 'self' blob:",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: supabaseStorageBinding ? [supabaseStorageBinding.remotePattern] : [],
    maximumRedirects: 0,
    dangerouslyAllowLocalIP: false,
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
  },
  async redirects() {
    return [
      {
        source: '/seller/dashboard',
        destination: '/dashboard/seller',
        permanent: true,
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
