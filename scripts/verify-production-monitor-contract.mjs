import fs from 'node:fs'

const monitorWorkflow = fs.readFileSync('.github/workflows/production-monitor.yml', 'utf8')
const capacityWorkflow = fs.readFileSync('.github/workflows/production-capacity.yml', 'utf8')
const smoke = fs.readFileSync('scripts/test-production-http-smoke.mjs', 'utf8')
const capacity = fs.readFileSync('scripts/test-production-read-capacity.mjs', 'utf8')

const failures = []
const fail = (message) => failures.push(message)
const canonicalBinding = '26f7fc5faab297eb924e4a0f'

const monitorBinding = monitorWorkflow.match(
  /ENTIZNETSTORE_EXPECTED_BACKEND_BINDING:\s*([0-9a-f]{24})\b/,
)?.[1]
const capacityBinding = capacityWorkflow.match(
  /CAPACITY_EXPECTED_BACKEND_BINDING:\s*([0-9a-f]{24})\b/,
)?.[1]

if (monitorBinding !== canonicalBinding) {
  fail('Production Monitor must pin the canonical backend binding fingerprint')
}
if (capacityBinding !== canonicalBinding) {
  fail('Production Read Capacity Gate must pin the canonical backend binding fingerprint')
}
if (monitorBinding && capacityBinding && monitorBinding !== capacityBinding) {
  fail('Production smoke and capacity proof must target the same backend authority')
}

if (!monitorWorkflow.includes('ENTIZNETSTORE_EXPECTED_SHA: ${{ github.sha }}')) {
  fail('Production Monitor must pin the expected deployment SHA to github.sha')
}
if (!capacityWorkflow.includes('CAPACITY_EXPECTED_SHA: ${{ github.sha }}')) {
  fail('Production Read Capacity Gate must pin the expected deployment SHA to github.sha')
}

if (!monitorWorkflow.includes('ENTIZNETSTORE_BASE_URL: https://entiznetstore.vercel.app')) {
  fail('Production Monitor must target the canonical EntizNetStore production origin')
}
if (!capacityWorkflow.includes('CAPACITY_EXPECTED_ORIGIN: https://entiznetstore.vercel.app')) {
  fail('Production Read Capacity Gate must target the canonical EntizNetStore production origin')
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

for (const required of [
  'CAPACITY_EXPECTED_BACKEND_BINDING',
  'body?.backendBinding === expectedBackendBinding',
  'body?.launchGates?.uploadSafety',
  'body?.launchGates?.indexing',
  'body?.launchGates?.storeChat',
  'body?.launchGates?.messageTranslation',
  'backend_binding_mismatch',
  'launch_gate_contract_invalid',
]) {
  if (!capacity.includes(required)) {
    fail(`Production capacity contract is missing required authority check: ${required}`)
  }
}

if (!smoke.includes("/^[0-9a-f]{24}$/") || !capacity.includes("/^[0-9a-f]{24}$/")) {
  fail('Production smoke and capacity probes must validate backend-binding fingerprint shape')
}

if (
  !monitorWorkflow.includes('backend-binding drift') ||
  !monitorWorkflow.includes('launch-gate contract loss')
) {
  fail('Production incident text must classify backend/launch-gate drift as release incidents')
}

if (failures.length) {
  console.error('Production release authority contract FAILED:\n')
  failures.forEach((message) => console.error(`- ${message}`))
  process.exit(1)
}

console.log(
  `Production release authority contract verified for canonical backend ${canonicalBinding}`,
)
