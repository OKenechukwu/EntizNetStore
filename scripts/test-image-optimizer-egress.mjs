const rawOrigin = process.env.APP_ORIGIN || process.env.ENTIZNETSTORE_BASE_URL

if (!rawOrigin) {
  console.error('APP_ORIGIN is required for the image optimizer egress regression')
  process.exit(2)
}

let appOrigin
try {
  appOrigin = new URL(rawOrigin)
} catch {
  console.error('APP_ORIGIN must be an absolute URL')
  process.exit(2)
}

const failures = []

async function expectOptimizerRejects(label, target) {
  const probe = new URL('/_next/image', appOrigin)
  probe.searchParams.set('url', target)
  probe.searchParams.set('w', '64')
  probe.searchParams.set('q', '75')

  let response
  try {
    response = await fetch(probe, {
      redirect: 'manual',
      headers: { 'User-Agent': 'EntizNetStore-image-egress-regression/1.0' },
    })
  } catch (error) {
    failures.push(`${label}: optimizer request failed: ${error instanceof Error ? error.message : 'unknown error'}`)
    return
  }

  if (response.status !== 400) {
    failures.push(`${label}: expected HTTP 400 before any remote fetch, got ${response.status}`)
  }
}

await expectOptimizerRejects('arbitrary HTTPS origin', 'https://example.com/untrusted.png')
await expectOptimizerRejects('application loopback origin', `${appOrigin.origin}/api/health`)

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
if (rawSupabaseUrl) {
  const supabase = new URL(rawSupabaseUrl)
  await expectOptimizerRejects('Supabase non-storage path', new URL('/auth/v1/health', supabase).toString())
  await expectOptimizerRejects(
    'private KYC bucket through public-object route',
    new URL('/storage/v1/object/public/kyc-documents/test/passport.png', supabase).toString(),
  )
  await expectOptimizerRejects(
    'message attachment bucket through public-object route',
    new URL('/storage/v1/object/public/message-attachments/test/message.png', supabase).toString(),
  )
}

if (failures.length) {
  console.error('Image optimizer egress regression FAILED:\n')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log(`Image optimizer egress regression passed for ${appOrigin.origin}`)
