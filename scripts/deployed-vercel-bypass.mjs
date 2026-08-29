const rawBaseUrl = process.env.DEPLOYED_AUTH_BASE_URL
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET

if (!rawBaseUrl) {
  throw new Error('DEPLOYED_AUTH_BASE_URL is required before installing the deployment-protection fetch wrapper')
}

const appOrigin = new URL(rawBaseUrl).origin

if (new URL(rawBaseUrl).hostname.endsWith('.vercel.app') && !bypassSecret) {
  throw new Error('VERCEL_AUTOMATION_BYPASS_SECRET is required for protected Vercel preview verification')
}

if (bypassSecret) {
  const nativeFetch = globalThis.fetch
  globalThis.fetch = async (input, init = {}) => {
    const requestUrl = input instanceof Request ? new URL(input.url) : new URL(String(input), appOrigin)
    if (requestUrl.origin !== appOrigin) return nativeFetch(input, init)

    // Vercel supports automation bypass via both header and query parameter.
    // Include both on every application request so the runner never depends on
    // a bypass cookie. Requesting x-vercel-set-bypass-cookie can intentionally
    // produce a redirect while Vercel establishes that cookie, which conflicts
    // with this security gate's redirect:'manual' assertions.
    requestUrl.searchParams.set('x-vercel-protection-bypass', bypassSecret)

    const headers = new Headers(input instanceof Request ? input.headers : undefined)
    new Headers(init.headers).forEach((value, key) => headers.set(key, value))
    headers.set('x-vercel-protection-bypass', bypassSecret)

    return nativeFetch(requestUrl, { ...init, headers })
  }
}
