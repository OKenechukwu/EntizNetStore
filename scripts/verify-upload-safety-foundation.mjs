import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []

function read(relativePath) {
  const absolute = path.join(root, relativePath)
  if (!fs.existsSync(absolute)) {
    failures.push(`missing required upload-safety file: ${relativePath}`)
    return ''
  }
  return fs.readFileSync(absolute, 'utf8')
}

function requireFragments(relativePath, fragments) {
  const content = read(relativePath)
  for (const fragment of fragments) {
    if (!content.includes(fragment)) {
      failures.push(`${relativePath} lost required upload-safety control: ${fragment}`)
    }
  }
}

requireFragments('package.json', [
  'test:upload-scanner',
  'tests/upload-scanner-network-policy.test.mts',
  'test:upload-safety-http',
  'verify-upload-safety-foundation.mjs',
])

requireFragments('.github/workflows/http-authorization.yml', [
  'UPLOAD_SCANNER_MODE: deterministic',
  'npm run test:upload-scanner',
  'npm run test:upload-safety-http',
  'scripts/test-http-authorization.mjs',
  'scripts/test-web-responsive-browser.mjs',
  'scripts/test-web-accessibility-browser.mjs',
])

requireFragments('.env.example', [
  'UPLOAD_SCANNER_MODE=remote',
  'UPLOAD_SCANNER_URL=https://YOUR_PRIVATE_SCANNER.example.com/scan',
  'UPLOAD_SCANNER_ALLOWED_ORIGINS=https://YOUR_PRIVATE_SCANNER.example.com',
  'UPLOAD_SCANNER_TOKEN=YOUR_SCANNER_BEARER_TOKEN',
])

requireFragments('lib/storage/uploadScanner.ts', [
  'UPLOAD_SCANNER_ALLOWED_ORIGINS',
  'scanner_allowed_origins_missing',
  'scanner_origin_not_allowed',
  'scanner_endpoint_private_host_forbidden',
  'scanner_endpoint_unsafe',
  'scanner_token_invalid',
  'scanner_sha256_mismatch',
  "'X-EntizNetStore-Scanner-Protocol': '1'",
  "redirect: 'error'",
  'scanner_response_content_type_invalid',
  'scanner_response_too_large',
  'readBoundedResponseText',
  'MAX_SCANNABLE_BYTES',
  "normalized.startsWith('[') && normalized.endsWith(']')",
])

requireFragments('tests/upload-scanner.test.mts', [
  'production scanner requires HTTPS, explicit origin allowlist, and bearer authentication',
  'production scanner refuses endpoint drift, private/IP hosts, query credentials, and malformed allowlists',
  'production scanner sends only bounded protocol metadata and accepts clean JSON verdict',
  'remote scanner blocks malicious verdicts without accepting provider free-form metadata',
  'remote scanner fails closed on wrong content type, malformed JSON, oversized responses, timeout, and digest mismatch',
  "assert.equal(headers.has('x-entiznetstore-filename'), false)",
])

requireFragments('tests/upload-scanner-network-policy.test.mts', [
  'production blocks IPv6 literals even when accidentally allowlisted',
  'production blocks private/local hostname suffixes even when accidentally allowlisted',
  'production rejects malformed bearer token material before network activity',
])

requireFragments('app/api/health/route.ts', [
  'validateUploadScannerConfiguration',
  "uploadSafety: uploadScannerConfiguration.ok ? 'configured' : 'blocked'",
])

requireFragments('scripts/test-production-http-smoke.mjs', [
  "['configured', 'blocked'].includes(body?.launchGates?.uploadSafety)",
])

requireFragments('docs/operations/UPLOAD_SCANNER_SECURITY.md', [
  'explicit comma-separated allowlist of exact HTTPS origins',
  'does **not** send the user\'s filename',
  '16 KiB response ceiling',
  'engineering contract alone does not clear P0-05',
])

requireFragments('scripts/test-upload-safety-http.mjs', [
  'clean scan job registers KYC evidence',
  'registered KYC evidence cannot be discarded by upload cleanup',
  'same promoted KYC path cannot be registered twice',
  'concurrent product finalization is single-writer/idempotent',
  "assert.equal(registeredJob.status, 'registered')",
  'upload_scan_job_id',
])

requireFragments('supabase/migrations/20260826065000_p0_upload_quarantine_scanning.sql', [
  "'registering'",
  "'registered'",
  'registered_at',
  'registered_record_id',
  'upload_scan_job_id',
  'upload_scan_jobs_registration_state_check',
  'upload_scan_jobs_registered_evidence_check',
  'upload_scan_jobs_registration_metadata_check',
])

requireFragments('app/api/kyc/documents/route.ts', [
  "status: 'registering'",
  "status: 'registered'",
  'upload_scan_job_id',
  'sha256Hex',
  ".eq('status', 'clean')",
])

requireFragments('lib/storage/quarantine.ts', [
  'async function transitionJob(',
  'expectedStatus: UploadScanStatus',
  ".eq('actor_id', actorId)",
  ".eq('status', expectedStatus)",
  "transitionJob(job.id, input.actorId, 'pending_upload'",
  "transitionJob(job.id, input.actorId, 'scanning'",
])

requireFragments('lib/storage/discardKycUpload.ts', [
  "data.status === 'registered'",
  "data.status === 'registering' || data.status === 'scanning'",
  "scanner_result_code: 'registration_abandoned_cleanup_pending'",
  ".eq('status', 'clean')",
])

if (failures.length) {
  console.error('Upload-safety foundation verification FAILED:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Upload-safety foundation verification passed.')
