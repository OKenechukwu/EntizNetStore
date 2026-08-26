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
  'upload_scan_jobs_registration_evidence_check',
])

requireFragments('app/api/kyc/documents/route.ts', [
  "status: 'registering'",
  "status: 'registered'",
  'upload_scan_job_id',
  'sha256Hex',
  "eq('status', 'clean')",
])

requireFragments('lib/storage/quarantine.ts', [
  "eq('status', 'pending_upload')",
  "eq('status', 'scanning')",
  'scan_claim_conflict',
])

requireFragments('lib/storage/discardKycUpload.ts', [
  "eq('status', 'clean')",
  'already_finalized',
])

if (failures.length) {
  console.error('Upload-safety foundation verification FAILED:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Upload-safety foundation verification passed.')
