import assert from 'node:assert/strict';
import test from 'node:test';
import {
  scanUploadBytes,
  sha256Hex,
  validateUploadScannerConfiguration,
} from '../lib/storage/uploadScanner.ts';
import { validateUploadedBytes } from '../lib/storage/validatedUpload.ts';

const png = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);
const eicar = new TextEncoder().encode(
  'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
);
const scannerEnvironmentKeys = [
  'UPLOAD_SCANNER_MODE',
  'UPLOAD_SCANNER_URL',
  'UPLOAD_SCANNER_ALLOWED_ORIGINS',
  'UPLOAD_SCANNER_TOKEN',
  'UPLOAD_SCANNER_TIMEOUT_MS',
  'NODE_ENV',
  'CI',
] as const;

function snapshotEnvironment() {
  return Object.fromEntries(scannerEnvironmentKeys.map((key) => [key, process.env[key]]));
}

function restoreEnvironment(snapshot: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function configureProductionRemoteScanner() {
  process.env.UPLOAD_SCANNER_MODE = 'remote';
  process.env.NODE_ENV = 'production';
  delete process.env.CI;
  process.env.UPLOAD_SCANNER_URL = 'https://scanner.example.test/v1/scan';
  process.env.UPLOAD_SCANNER_ALLOWED_ORIGINS = 'https://scanner.example.test';
  process.env.UPLOAD_SCANNER_TOKEN = 'scanner-test-token';
}

test('byte validation accepts matching signatures and rejects MIME spoofing', () => {
  assert.equal(
    validateUploadedBytes(png, { maxBytes: 1024, imagesOnly: true, declaredMime: 'image/png' })?.mimeType,
    'image/png',
  );
  assert.equal(
    validateUploadedBytes(png, { maxBytes: 1024, imagesOnly: true, declaredMime: 'image/jpeg' }),
    null,
  );
  assert.equal(validateUploadedBytes(png, { maxBytes: 4, imagesOnly: true }), null);
});

test('deterministic CI scanner proves clean and blocked verdict paths', async () => {
  const snapshot = snapshotEnvironment();
  process.env.UPLOAD_SCANNER_MODE = 'deterministic';
  process.env.NODE_ENV = 'test';
  delete process.env.CI;

  try {
    const clean = await scanUploadBytes(png, { mimeType: 'image/png' });
    assert.equal(clean.verdict, 'clean');
    assert.equal(clean.scanner, 'deterministic-ci');

    const blocked = await scanUploadBytes(eicar, { mimeType: 'text/plain' });
    assert.equal(blocked.verdict, 'blocked');
    assert.equal(blocked.code, 'eicar_test_signature');
  } finally {
    restoreEnvironment(snapshot);
  }
});

test('production cannot use deterministic scanner mode', async () => {
  const snapshot = snapshotEnvironment();
  process.env.UPLOAD_SCANNER_MODE = 'deterministic';
  process.env.NODE_ENV = 'production';
  delete process.env.CI;

  try {
    const result = await scanUploadBytes(png, { mimeType: 'image/png' });
    assert.equal(result.verdict, 'unavailable');
    assert.equal(result.code, 'deterministic_mode_forbidden_in_production');
    assert.deepEqual(validateUploadScannerConfiguration(), {
      ok: false,
      code: 'deterministic_mode_forbidden_in_production',
    });
  } finally {
    restoreEnvironment(snapshot);
  }
});

test('missing production scanner endpoint fails closed', async () => {
  const snapshot = snapshotEnvironment();
  process.env.UPLOAD_SCANNER_MODE = 'remote';
  process.env.NODE_ENV = 'production';
  delete process.env.UPLOAD_SCANNER_URL;

  try {
    const result = await scanUploadBytes(png, { mimeType: 'image/png' });
    assert.equal(result.verdict, 'unavailable');
    assert.equal(result.code, 'scanner_endpoint_missing');
  } finally {
    restoreEnvironment(snapshot);
  }
});

test('production scanner requires HTTPS, explicit origin allowlist, and bearer authentication', async () => {
  const snapshot = snapshotEnvironment();
  process.env.UPLOAD_SCANNER_MODE = 'remote';
  process.env.NODE_ENV = 'production';
  delete process.env.CI;
  delete process.env.UPLOAD_SCANNER_TOKEN;
  delete process.env.UPLOAD_SCANNER_ALLOWED_ORIGINS;

  try {
    process.env.UPLOAD_SCANNER_URL = 'http://scanner.example.test/scan';
    const insecure = await scanUploadBytes(png, { mimeType: 'image/png' });
    assert.equal(insecure.code, 'scanner_endpoint_must_use_https');

    process.env.UPLOAD_SCANNER_URL = 'https://scanner.example.test/scan';
    const noAllowlist = await scanUploadBytes(png, { mimeType: 'image/png' });
    assert.equal(noAllowlist.code, 'scanner_allowed_origins_missing');

    process.env.UPLOAD_SCANNER_ALLOWED_ORIGINS = 'https://scanner.example.test';
    const unauthenticated = await scanUploadBytes(png, { mimeType: 'image/png' });
    assert.equal(unauthenticated.code, 'scanner_token_missing');
  } finally {
    restoreEnvironment(snapshot);
  }
});

test('production scanner refuses endpoint drift, private/IP hosts, query credentials, and malformed allowlists', async () => {
  const snapshot = snapshotEnvironment();
  configureProductionRemoteScanner();

  try {
    process.env.UPLOAD_SCANNER_ALLOWED_ORIGINS = 'https://other-scanner.example.test';
    assert.equal(
      (await scanUploadBytes(png, { mimeType: 'image/png' })).code,
      'scanner_origin_not_allowed',
    );

    process.env.UPLOAD_SCANNER_URL = 'https://127.0.0.1/scan';
    process.env.UPLOAD_SCANNER_ALLOWED_ORIGINS = 'https://127.0.0.1';
    assert.equal(
      (await scanUploadBytes(png, { mimeType: 'image/png' })).code,
      'scanner_endpoint_private_host_forbidden',
    );

    process.env.UPLOAD_SCANNER_URL = 'https://scanner.example.test/scan?api_key=must-not-live-in-url';
    process.env.UPLOAD_SCANNER_ALLOWED_ORIGINS = 'https://scanner.example.test';
    assert.equal(
      (await scanUploadBytes(png, { mimeType: 'image/png' })).code,
      'scanner_endpoint_unsafe',
    );

    process.env.UPLOAD_SCANNER_URL = 'https://scanner.example.test/scan';
    process.env.UPLOAD_SCANNER_ALLOWED_ORIGINS = 'https://scanner.example.test/not-an-origin';
    assert.equal(
      (await scanUploadBytes(png, { mimeType: 'image/png' })).code,
      'scanner_allowed_origins_invalid',
    );
  } finally {
    restoreEnvironment(snapshot);
  }
});

test('scanner endpoint rejects embedded credentials and URL fragments', async () => {
  const snapshot = snapshotEnvironment();
  process.env.UPLOAD_SCANNER_MODE = 'remote';
  process.env.NODE_ENV = 'test';

  try {
    process.env.UPLOAD_SCANNER_URL = 'https://user:pass@scanner.example.test/scan';
    const credentials = await scanUploadBytes(png, { mimeType: 'image/png' });
    assert.equal(credentials.code, 'scanner_endpoint_unsafe');

    process.env.UPLOAD_SCANNER_URL = 'https://scanner.example.test/scan#secret';
    const fragment = await scanUploadBytes(png, { mimeType: 'image/png' });
    assert.equal(fragment.code, 'scanner_endpoint_unsafe');
  } finally {
    restoreEnvironment(snapshot);
  }
});

test('production scanner sends only bounded protocol metadata and accepts clean JSON verdict', async () => {
  const snapshot = snapshotEnvironment();
  const originalFetch = globalThis.fetch;
  configureProductionRemoteScanner();
  let calls = 0;

  globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    calls += 1;
    assert.equal(String(input), 'https://scanner.example.test/v1/scan');
    assert.equal(init?.method, 'POST');
    assert.equal(init?.redirect, 'error');
    assert.equal(init?.cache, 'no-store');
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('authorization'), 'Bearer scanner-test-token');
    assert.equal(headers.get('content-type'), 'application/octet-stream');
    assert.equal(headers.get('x-entiznetstore-content-type'), 'image/png');
    assert.equal(headers.get('x-entiznetstore-scanner-protocol'), '1');
    assert.equal(headers.get('x-entiznetstore-sha256'), sha256Hex(png));
    assert.equal(headers.has('x-entiznetstore-filename'), false);

    return new Response(
      JSON.stringify({ verdict: 'clean', scanner: 'Vendor Scanner', version: '2026.8', code: 'clean' }),
      { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } },
    );
  }) as typeof fetch;

  try {
    const result = await scanUploadBytes(png, { mimeType: 'image/png', sha256: sha256Hex(png) });
    assert.equal(calls, 1);
    assert.equal(result.verdict, 'clean');
    assert.equal(result.scanner, 'Vendor_Scanner');
    assert.equal(result.version, '2026.8');
    assert.equal(validateUploadScannerConfiguration().ok, true);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment(snapshot);
  }
});

test('remote scanner blocks malicious verdicts without accepting provider free-form metadata', async () => {
  const snapshot = snapshotEnvironment();
  const originalFetch = globalThis.fetch;
  configureProductionRemoteScanner();

  globalThis.fetch = (async () => new Response(
    JSON.stringify({
      verdict: 'blocked',
      scanner: 'Vendor\nScanner',
      version: 'v1\r\nInjected',
      code: 'malware signature with spaces',
      message: 'This provider-controlled field must never enter the result contract',
    }),
    { status: 200, headers: { 'content-type': 'application/problem+json' } },
  )) as typeof fetch;

  try {
    const result = await scanUploadBytes(eicar, { mimeType: 'application/pdf' });
    assert.equal(result.verdict, 'blocked');
    assert.equal(result.scanner, 'VendorScanner');
    assert.equal(result.version, 'v1Injected');
    assert.equal(result.code, 'malware_signature_with_spaces');
    assert.equal('message' in result, false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment(snapshot);
  }
});

test('remote scanner fails closed on wrong content type, malformed JSON, oversized responses, timeout, and digest mismatch', async () => {
  const snapshot = snapshotEnvironment();
  const originalFetch = globalThis.fetch;
  configureProductionRemoteScanner();

  try {
    globalThis.fetch = (async () => new Response('{"verdict":"clean"}', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    })) as typeof fetch;
    assert.equal(
      (await scanUploadBytes(png, { mimeType: 'image/png' })).code,
      'scanner_response_content_type_invalid',
    );

    globalThis.fetch = (async () => new Response('not-json', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;
    assert.equal(
      (await scanUploadBytes(png, { mimeType: 'image/png' })).code,
      'scanner_response_invalid',
    );

    globalThis.fetch = (async () => new Response(
      JSON.stringify({ verdict: 'clean', code: 'x'.repeat(20_000) }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )) as typeof fetch;
    assert.equal(
      (await scanUploadBytes(png, { mimeType: 'image/png' })).code,
      'scanner_response_too_large',
    );

    globalThis.fetch = (async () => {
      const error = new Error('simulated timeout');
      error.name = 'AbortError';
      throw error;
    }) as typeof fetch;
    assert.equal(
      (await scanUploadBytes(png, { mimeType: 'image/png' })).code,
      'scanner_timeout',
    );

    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      throw new Error('fetch should not be called');
    }) as typeof fetch;
    assert.equal(
      (await scanUploadBytes(png, { mimeType: 'image/png', sha256: '0'.repeat(64) })).code,
      'scanner_sha256_mismatch',
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment(snapshot);
  }
});

test('sha256 fingerprint is deterministic and full length', () => {
  const first = sha256Hex(png);
  const second = sha256Hex(png);
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{64}$/);
});
