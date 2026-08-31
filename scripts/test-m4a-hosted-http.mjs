import {
  createHostedAppFetch,
  preflightHostedM4A,
  resolveHostedM4ATarget,
} from './m4a-hosted-safety.mjs'

const target = resolveHostedM4ATarget()

// Normalize the environment consumed by the canonical M4A test. The wrapper
// deliberately does not accept a different application/database target after
// the hosted safety preflight has passed.
process.env.APP_ORIGIN = target.appOrigin.origin
process.env.SUPABASE_URL = target.supabaseOrigin.origin
process.env.NEXT_PUBLIC_SUPABASE_URL = target.supabaseOrigin.origin

const nativeFetch = globalThis.fetch.bind(globalThis)
const guardedFetch = createHostedAppFetch(target, nativeFetch)
globalThis.fetch = guardedFetch

try {
  await preflightHostedM4A(target, guardedFetch)
  await import('./test-m4a-http-authorization.mjs')
} finally {
  globalThis.fetch = nativeFetch
}
