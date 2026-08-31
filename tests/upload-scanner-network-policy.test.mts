import assert from 'node:assert/strict';
import test from 'node:test';
import { scanUploadBytes } from '../lib/storage/uploadScanner.ts';

const sample = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
const keys = [
  'UPLOAD_SCANNER_MODE',
  'UPLOAD_SCANNER_URL',
  'UPLOAD_SCANNER_ALLOWED_ORIGINS',
  'UPLOAD_SCANNER_TOKEN',
  'NODE_ENV',
  'CI',
] as const;

function snapshotEnvironment() {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function restoreEnvironment(snapshot: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function configure(endpoint: string, allowedOrigin: string, token = 'scanner-test-token') {
  process.env.UPLOAD_SCANNER_MODE = 'remote';
  process.env.NODE_ENV = 'production';
  delete process.env.CI;
  process.env.UPLOAD_SCANNER_URL = endpoint;
  process.env.UPLOAD_SCANNER_ALLOWED_ORIGINS = allowedOrigin;
  process.env.UPLOAD_SCANNER_TOKEN = token;
}

test('production blocks IPv6 literals even when accidentally allowlisted', async () => {
  const snapshot = snapshotEnvironment();
  try {
    configure('https://[::1]/scan', 'https://[::1]');
    const result = await scanUploadBytes(sample, { mimeType: 'image/png' });
    assert.equal(result.verdict, 'unavailable');
    assert.equal(result.code, 'scanner_endpoint_private_host_forbidden');
  } finally {
    restoreEnvironment(snapshot);
  }
});

test('production blocks private/local hostname suffixes even when accidentally allowlisted', async () => {
  const snapshot = snapshotEnvironment();
  try {
    for (const hostname of ['scanner.internal', 'scanner.local', 'scanner.localdomain', 'scanner.lan']) {
      configure(`https://${hostname}/scan`, `https://${hostname}`);
      const result = await scanUploadBytes(sample, { mimeType: 'image/png' });
      assert.equal(result.code, 'scanner_endpoint_private_host_forbidden', hostname);
    }
  } finally {
    restoreEnvironment(snapshot);
  }
});

test('production rejects malformed bearer token material before network activity', async () => {
  const snapshot = snapshotEnvironment();
  const originalFetch = globalThis.fetch;
  let called = false;
  try {
    configure('https://scanner.example.test/scan', 'https://scanner.example.test', ' scanner-token ');
    globalThis.fetch = (async () => {
      called = true;
      throw new Error('fetch must not run');
    }) as typeof fetch;

    const result = await scanUploadBytes(sample, { mimeType: 'image/png' });
    assert.equal(result.code, 'scanner_token_invalid');
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment(snapshot);
  }
});
