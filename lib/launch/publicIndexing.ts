export const PUBLIC_LAUNCH_CONFIRMATION_VALUE = 'ENTIZNETSTORE_PUBLIC_WEB_V1' as const

const NEVER_INDEX_PREFIXES = [
  '/api',
  '/admin',
  '/dashboard',
  '/auth',
  '/checkout',
  '/cart',
  '/wishlist',
  '/messages',
  '/notifications',
  '/seller/dashboard',
  '/internal',
] as const

type LaunchEnvironment = Record<string, string | undefined>

function normalizedPathname(pathname: string) {
  const raw = pathname.trim() || '/'
  const withoutQuery = raw.split(/[?#]/, 1)[0] || '/'
  const leadingSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`
  return leadingSlash.length > 1 ? leadingSlash.replace(/\/+$/, '') : '/'
}

function pathMatchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function publicIndexingAllowed(env: LaunchEnvironment = process.env) {
  return (
    env.VERCEL_ENV === 'production' &&
    env.SITE_INDEXING_ENABLED === 'true' &&
    env.PUBLIC_LAUNCH_CONFIRMATION === PUBLIC_LAUNCH_CONFIRMATION_VALUE
  )
}

export function shouldNeverIndexPath(pathname: string) {
  const normalized = normalizedPathname(pathname)
  return NEVER_INDEX_PREFIXES.some((prefix) => pathMatchesPrefix(normalized, prefix))
}

export function shouldSendNoIndex(pathname: string, env: LaunchEnvironment = process.env) {
  return !publicIndexingAllowed(env) || shouldNeverIndexPath(pathname)
}

export function publicIndexingLaunchStatus(env: LaunchEnvironment = process.env) {
  return publicIndexingAllowed(env) ? 'enabled' : 'blocked'
}

export function publicRobotsRules(env: LaunchEnvironment = process.env) {
  if (!publicIndexingAllowed(env)) {
    return [{ userAgent: '*', disallow: '/' }]
  }

  return [
    {
      userAgent: '*',
      allow: '/',
      disallow: NEVER_INDEX_PREFIXES.map((prefix) => `${prefix}/`),
    },
  ]
}
