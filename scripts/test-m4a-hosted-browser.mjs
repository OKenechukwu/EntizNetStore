import http from 'node:http'
import {
  createHostedAppFetch,
  preflightHostedM4A,
  resolveHostedM4ATarget,
} from './m4a-hosted-safety.mjs'

const target = resolveHostedM4ATarget()
const upstreamFetch = createHostedAppFetch(target)

await preflightHostedM4A(target, upstreamFetch)

process.env.SUPABASE_URL = target.supabaseOrigin.origin
process.env.NEXT_PUBLIC_SUPABASE_URL = target.supabaseOrigin.origin

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : undefined))
    request.on('error', reject)
  })
}

function copyRequestHeaders(request, proxyOrigin) {
  const headers = new Headers()
  for (const [name, rawValue] of Object.entries(request.headers)) {
    if (rawValue === undefined) continue
    const lower = name.toLowerCase()
    if (['host', 'connection', 'content-length', 'accept-encoding'].includes(lower)) continue
    const value = Array.isArray(rawValue) ? rawValue.join(', ') : rawValue
    headers.set(name, value)
  }

  // Preserve browser same-origin semantics from the isolated deployment's
  // perspective without ever exposing the Vercel bypass credential client-side.
  const originHeader = headers.get('origin')
  if (originHeader === proxyOrigin) headers.set('origin', target.appOrigin.origin)
  const refererHeader = headers.get('referer')
  if (refererHeader?.startsWith(`${proxyOrigin}/`)) {
    headers.set('referer', `${target.appOrigin.origin}${refererHeader.slice(proxyOrigin.length)}`)
  }
  headers.set('accept-encoding', 'identity')
  headers.set('user-agent', 'EntizNetStore-M4A-hosted-browser-proxy/1.0')
  return headers
}

function setResponseHeaders(response, serverResponse, proxyOrigin) {
  for (const [name, value] of response.headers.entries()) {
    const lower = name.toLowerCase()
    if (['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'set-cookie', 'location'].includes(lower)) {
      continue
    }
    serverResponse.setHeader(name, value)
  }

  const setCookies = response.headers.getSetCookie?.() || []
  if (setCookies.length) serverResponse.setHeader('set-cookie', setCookies)

  const location = response.headers.get('location')
  if (location) {
    let rewritten = location
    try {
      const resolved = new URL(location, target.appOrigin)
      if (resolved.origin === target.appOrigin.origin) {
        rewritten = `${proxyOrigin}${resolved.pathname}${resolved.search}${resolved.hash}`
      }
    } catch {
      // Preserve malformed/relative Location exactly; the browser regression
      // will fail visibly rather than this proxy guessing a redirect target.
    }
    serverResponse.setHeader('location', rewritten)
  }
}

const server = http.createServer(async (request, response) => {
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : null
  const proxyOrigin = `http://127.0.0.1:${port}`

  try {
    const upstreamUrl = new URL(request.url || '/', target.appOrigin)
    if (upstreamUrl.origin !== target.appOrigin.origin) {
      response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Invalid proxy target')
      return
    }

    const method = request.method || 'GET'
    const body = method === 'GET' || method === 'HEAD' ? undefined : await readRequestBody(request)
    const upstreamResponse = await upstreamFetch(upstreamUrl, {
      method,
      headers: copyRequestHeaders(request, proxyOrigin),
      body,
      redirect: 'manual',
    })

    response.statusCode = upstreamResponse.status
    response.statusMessage = upstreamResponse.statusText
    setResponseHeaders(upstreamResponse, response, proxyOrigin)

    if (method === 'HEAD' || [204, 304].includes(upstreamResponse.status)) {
      response.end()
      return
    }

    response.end(Buffer.from(await upstreamResponse.arrayBuffer()))
  } catch (error) {
    // Never echo request/upstream headers: they may contain auth cookies or the
    // Vercel bypass credential. The canonical browser suite will surface the
    // route failure with its own URL/HTTP assertion.
    response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
    response.end(`Hosted verification proxy failure: ${error instanceof Error ? error.message : 'unknown error'}`)
  }
})

await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
})

const address = server.address()
if (!address || typeof address === 'string') {
  server.close()
  throw new Error('hosted M4A browser proxy did not bind a loopback TCP port')
}

process.env.APP_ORIGIN = `http://127.0.0.1:${address.port}`
process.stdout.write(
  `ok - hosted M4A Chromium proxy ready for exact ${target.expectedCommit.slice(0, 12)} isolated deployment\n`,
)

try {
  await import('./test-m4a-browser.mjs')
} finally {
  await new Promise((resolve) => server.close(resolve))
}
