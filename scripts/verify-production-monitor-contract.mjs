import fs from 'node:fs'

const workflow = fs.readFileSync('.github/workflows/production-monitor.yml', 'utf8')
const smoke = fs.readFileSync('scripts/test-production-http-smoke.mjs', 'utf8')

const failures = []
const fail = (message) => failures.push(message)

const bindingMatch = workflow.match(/ENTIZNETSTORE_EXPECTED_BACKEND_BINDING:\s*([0-9a-f]{24})\b/)
if (!bindingMatch) {
  fail('Production Monitor must pin a 24-character canonical backend binding fingerprint')
}

if (!workflow.includes('ENTIZNETSTORE_EXPECTED_SHA: ${{ github.sha }}')) {
  fail('Production Monitor must pin the expected deployment SHA to github.sha')
}

if (!workflow.includes('ENTIZNETSTORE_BASE_URL: https://entiznetstore.vercel.app')) {
  fail('Production Monitor must target the canonical EntizNetStore production origin')
}

for (const required of [
  'ENTIZNETSTORE_EXPECTED_BACKEND_BINDING',
  'body?.launchGates?.uploadSafety',
  'body?.launchGates?.indexing',
  'body?.launchGates?.storeChat',
  'body?.launchGates?.messageTranslation',
  'production backend drift',
  'production deployment drift',
]) {
  if (!smoke.includes(required)) {
    fail(`Production smoke contract is missing required authority check: ${required}`)
  }
}

if (!smoke.includes("/^[0-9a-f]{24}$/")) {
  fail('Production smoke must validate backend-binding fingerprint shape')
}

if (!workflow.includes('backend-binding drift') || !workflow.includes('launch-gate contract loss')) {
  fail('Production incident text must classify backend/launch-gate drift as release incidents')
}

if (failures.length) {
  console.error('Production monitor contract FAILED:\n')
  failures.forEach((message) => console.error(`- ${message}`))
  process.exit(1)
}

console.log(
  `Production monitor contract verified for canonical backend ${bindingMatch?.[1] ?? 'unknown'}`,
)
