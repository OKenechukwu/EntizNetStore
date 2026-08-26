import assert from 'node:assert/strict';
import test from 'node:test';
import { scanUploadBytes, sha256Hex } from '../lib/storage/uploadScanner.ts';
import { validateUploadedBytes } from '../lib/storage/validatedUpload.ts';

const png = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);
const eicar = new TextEncoder().encode(
  'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
);

function restoreEnvironment(snapshot: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
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
  const snapshot = {
    UPLOAD_SCANNER_MODE: process.env.UPLOAD_SCANNER_MODE,
    NODE_ENV: process.env.NODE_ENV,
    CI: process.env.CI,
  };
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
  const snapshot = {
    UPLOAD_SCANNER_MODE: process.env.UPLOAD_SCANNER_MODE,
    NODE_ENV: process.env.NODE_ENV,
    CI: process.env.CI,
  };
  process.env.UPLOAD_SCANNER_MODE = 'deterministic';
  process.env.NODE_ENV = 'production';
  delete process.env.CI;

  try {
    const result = await scanUploadBytes(png, { mimeType: 'image/png' });
    assert.equal(result.verdict, 'unavailable');
    assert.equal(result.code, 'deterministic_mode_forbidden_in_production');
  } finally {
    restoreEnvironment(snapshot);
  }
});

test('missing production scanner endpoint fails closed', async () => {
  const snapshot = {
    UPLOAD_SCANNER_MODE: process.env.UPLOAD_SCANNER_MODE,
    UPLOAD_SCANNER_URL: process.env.UPLOAD_SCANNER_URL,
  };
  process.env.UPLOAD_SCANNER_MODE = 'remote';
  delete process.env.UPLOAD_SCANNER_URL;

  try {
    const result = await scanUploadBytes(png, { mimeType: 'image/png' });
    assert.equal(result.verdict, 'unavailable');
    assert.equal(result.code, 'scanner_endpoint_missing');
  } finally {
    restoreEnvironment(snapshot);
  }
});

test('production remote scanner requires HTTPS and bearer authentication', async () => {
  const snapshot = {
    UPLOAD_SCANNER_MODE: process.env.UPLOAD_SCANNER_MODE,
    UPLOAD_SCANNER_URL: process.env.UPLOAD_SCANNER_URL,
    UPLOAD_SCANNER_TOKEN: process.env.UPLOAD_SCANNER_TOKEN,
    NODE_ENV: process.env.NODE_ENV,
  };
  process.env.UPLOAD_SCANNER_MODE = 'remote';
  process.env.NODE_ENV = 'production';
  delete process.env.UPLOAD_SCANNER_TOKEN;

  try {
    process.env.UPLOAD_SCANNER_URL = 'http://scanner.example.test/scan';
    const insecure = await scanUploadBytes(png, { mimeType: 'image/png' });
    assert.equal(insecure.verdict, 'unavailable');
    assert.equal(insecure.code, 'scanner_endpoint_must_use_https');

    process.env.UPLOAD_SCANNER_URL = 'https://scanner.example.test/scan';
    const unauthenticated = await scanUploadBytes(png, { mimeType: 'image/png' });
    assert.equal(unauthenticated.verdict, 'unavailable');
    assert.equal(unauthenticated.code, 'scanner_token_missing');
  } finally {
    restoreEnvironment(snapshot);
  }
});

test('scanner endpoint rejects embedded credentials and URL fragments', async () => {
  const snapshot = {
    UPLOAD_SCANNER_MODE: process.env.UPLOAD_SCANNER_MODE,
    UPLOAD_SCANNER_URL: process.env.UPLOAD_SCANNER_URL,
    NODE_ENV: process.env.NODE_ENV,
  };
  process.env.UPLOAD_SCANNER_MODE = 'remote';
  process.env.NODE_ENV = 'test';

  try {
    process.env.UPLOAD_SCANNER_URL = 'https://user:pass@scanner.example.test/scan';
    const credentials = await scanUploadBytes(png, { mimeType: 'image/png' });
    assert.equal(credentials.verdict, 'unavailable');
    assert.equal(credentials.code, 'scanner_endpoint_unsafe');

    process.env.UPLOAD_SCANNER_URL = 'https://scanner.example.test/scan#secret';
    const fragment = await scanUploadBytes(png, { mimeType: 'image/png' });
    assert.equal(fragment.verdict, 'unavailable');
    assert.equal(fragment.code, 'scanner_endpoint_unsafe');
  } finally {
    restoreEnvironment(snapshot);
  }
});

test('sha256 fingerprint is deterministic and full length', () => {
  const first = sha256Hex(png);
  const second = sha256Hex(png);
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{64}$/);
});
