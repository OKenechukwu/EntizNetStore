/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === 'production'

const scriptSources = ["'self'", "'unsafe-inline'"]
if (!isProduction) scriptSources.push("'unsafe-eval'")

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
  "img-src 'self' data: blob: https:",
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
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
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
