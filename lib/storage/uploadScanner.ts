import { createHash } from 'node:crypto';

export type UploadScanVerdict = 'clean' | 'blocked' | 'unavailable';

export type UploadScanResult = {
  verdict: UploadScanVerdict;
  scanner: string;
  version?: string;
  code: string;
};

export type UploadScanContext = {
  mimeType: string;
  sha256?: string;
};

const MAX_TIMEOUT_MS = 30_000;
const MIN_TIMEOUT_MS = 1_000;
const DEFAULT_TIMEOUT_MS = 12_000;
const EICAR_MARKER = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

function boundedText(value: unknown, fallback: string, max = 120) {
  if (typeof value !== 'string') return fallback;
  const safe = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  return safe || fallback;
}

function configuredTimeout() {
  const parsed = Number.parseInt(process.env.UPLOAD_SCANNER_TIMEOUT_MS || '', 10);
  if (!Number.isFinite(parsed)) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.max(parsed, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
}

function deterministicScannerAllowed() {
  return process.env.NODE_ENV !== 'production' || process.env.CI === 'true';
}

function deterministicScan(bytes: Uint8Array): UploadScanResult {
  // This mode exists only for local/CI contract testing. It is deliberately not
  // represented as production malware protection. The standard EICAR marker
  // gives us a stable blocked-file fixture without shipping executable malware.
  const sample = Buffer.from(bytes).toString('latin1');
  if (sample.includes(EICAR_MARKER)) {
    return {
      verdict: 'blocked',
      scanner: 'deterministic-ci',
      version: '1',
      code: 'eicar_test_signature',
    };
  }

  return {
    verdict: 'clean',
    scanner: 'deterministic-ci',
    version: '1',
    code: 'clean_test_fixture',
  };
}

export function sha256Hex(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function scanUploadBytes(
  bytes: Uint8Array,
  context: UploadScanContext,
): Promise<UploadScanResult> {
  const mode = (process.env.UPLOAD_SCANNER_MODE || 'remote').trim().toLowerCase();

  if (mode === 'deterministic') {
    if (!deterministicScannerAllowed()) {
      return {
        verdict: 'unavailable',
        scanner: 'configuration',
        code: 'deterministic_mode_forbidden_in_production',
      };
    }
    return deterministicScan(bytes);
  }

  if (mode !== 'remote') {
    return {
      verdict: 'unavailable',
      scanner: 'configuration',
      code: 'unsupported_scanner_mode',
    };
  }

  const endpoint = process.env.UPLOAD_SCANNER_URL?.trim();
  if (!endpoint) {
    return {
      verdict: 'unavailable',
      scanner: 'configuration',
      code: 'scanner_endpoint_missing',
    };
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return {
      verdict: 'unavailable',
      scanner: 'configuration',
      code: 'scanner_endpoint_invalid',
    };
  }

  if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.hostname === '127.0.0.1')) {
    return {
      verdict: 'unavailable',
      scanner: 'configuration',
      code: 'scanner_endpoint_must_use_https',
    };
  }

  const sha256 = context.sha256 || sha256Hex(bytes);
  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    'X-EntizNetStore-Content-Type': boundedText(context.mimeType, 'application/octet-stream', 100),
    'X-EntizNetStore-SHA256': sha256,
  };
  const token = process.env.UPLOAD_SCANNER_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: bytes,
      signal: AbortSignal.timeout(configuredTimeout()),
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        verdict: 'unavailable',
        scanner: 'remote',
        code: `scanner_http_${response.status}`,
      };
    }

    const payload = (await response.json().catch(() => null)) as null | {
      verdict?: unknown;
      scanner?: unknown;
      engine?: unknown;
      version?: unknown;
      code?: unknown;
    };
    if (!payload || (payload.verdict !== 'clean' && payload.verdict !== 'blocked')) {
      return {
        verdict: 'unavailable',
        scanner: 'remote',
        code: 'scanner_response_invalid',
      };
    }

    return {
      verdict: payload.verdict,
      scanner: boundedText(payload.scanner ?? payload.engine, 'remote', 80),
      version: boundedText(payload.version, 'unknown', 80),
      code: boundedText(payload.code, payload.verdict === 'clean' ? 'clean' : 'blocked'),
    };
  } catch (error) {
    return {
      verdict: 'unavailable',
      scanner: 'remote',
      code: error instanceof Error && error.name === 'TimeoutError'
        ? 'scanner_timeout'
        : 'scanner_request_failed',
    };
  }
}
