import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []

function read(relativePath) {
  const absolute = path.join(root, relativePath)
  if (!fs.existsSync(absolute)) {
    failures.push(`missing public-launch safety file: ${relativePath}`)
    return ''
  }
  return fs.readFileSync(absolute, 'utf8')
}

function requireFragments(relativePath, fragments) {
  const content = read(relativePath)
  for (const fragment of fragments) {
    if (!content.includes(fragment)) {
      failures.push(`${relativePath} lost public-launch safety control: ${fragment}`)
    }
  }
}

requireFragments('package.json', [
  'test:launch-indexing',
  'verify-public-launch-foundation.mjs',
])

requireFragments('.env.example', [
  'SITE_INDEXING_ENABLED=false',
  'PUBLIC_LAUNCH_CONFIRMATION=NOT_CONFIRMED',
  'ENTIZNETSTORE_PUBLIC_WEB_V1',
])

requireFragments('lib/launch/publicIndexing.ts', [
  "PUBLIC_LAUNCH_CONFIRMATION_VALUE = 'ENTIZNETSTORE_PUBLIC_WEB_V1'",
  "env.VERCEL_ENV === 'production'",
  "env.SITE_INDEXING_ENABLED === 'true'",
  'env.PUBLIC_LAUNCH_CONFIRMATION === PUBLIC_LAUNCH_CONFIRMATION_VALUE',
  "'/api'",
  "'/admin'",
  "'/dashboard'",
  "'/checkout'",
  "'/cart'",
  "'/messages'",
  "'/notifications'",
  'publicRobotsRules',
  "disallow: '/'",
])

requireFragments('app/layout.tsx', [
  'publicIndexingAllowed',
  'const siteIndexingEnabled = publicIndexingAllowed();',
  'index: false',
  'noarchive: true',
])

requireFragments('app/robots.ts', [
  'publicRobotsRules',
  'rules: publicRobotsRules()',
])

requireFragments('proxy.ts', [
  'shouldSendNoIndex',
  'X-Robots-Tag',
  'noindex, nofollow, noarchive',
])

requireFragments('app/api/health/route.ts', [
  'publicIndexingLaunchStatus',
  'indexing: publicIndexingLaunchStatus()',
])

requireFragments('tests/public-launch-indexing.test.mts', [
  'public indexing is blocked by default and by any single launch switch',
  'preview and development can never become indexable through copied launch flags',
  'indexing requires exact case-sensitive production confirmation',
  'sensitive/private route families remain non-indexable after public launch',
  'robots blocks the entire site before launch and excludes private route families after launch',
])

requireFragments('.github/workflows/ci.yml', [
  'Run public launch indexing regression',
  'npm run test:launch-indexing',
])

requireFragments('scripts/test-production-http-smoke.mjs', [
  "body?.launchGates?.indexing",
  "indexing launch gate",
  "X-Robots-Tag",
  '/robots.txt',
])

requireFragments('docs/operations/PUBLIC_LAUNCH_INTERLOCK.md', [
  'ENTIZNETSTORE_PUBLIC_WEB_V1',
  'VERCEL_ENV=production',
  'does not replace the P0 launch gates',
])

if (failures.length) {
  console.error('Public-launch foundation verification FAILED:\n')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Public-launch foundation verification passed.')
