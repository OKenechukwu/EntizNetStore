import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

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

export type UploadScannerConfigurationStatus =
  | { ok: true; mode: 'deterministic' | 'remote'; endpointOrigin?: string }
  | { ok: false; code: string };

const MAX_TIMEOUT_MS = 30_000;
const MIN_TIMEOUT_MS = 1_000;
const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_RESPONSE_BYTES = 16 * 1024;
const MAX_SCANNABLE_BYTES = 15 * 1024 * 1024;
const MAX_TOKEN_BYTES = 4096;
const EICAR_MARKER = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
const BLOCKED_PRODUCTION_HOST_SUFFIXES = ['.localhost', '.local', '.internal'] as const;

function unavailable(code: string, scanner = 'configuration'): UploadScanResult {
  return { verdict: 'unavailable', scanner, code };
}

function boundedHeaderValue(value: unknown, fallback: string, max = 120) {
  if (typeof value !== 'string') return fallback;
  const safe = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  return safe || fallback;
}

function boundedIdentifier(value: unknown, fallback: string, max = 80) {
  const safe = boundedHeaderValue(value, fallback, max)
    .replace(/[^a-zA-Z0-9._:-]/g, '_')
    .slice(0, max);
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

function parseAllowedOrigins(): { ok: true; origins: Set<string> } | { ok: false; code: string } {
  const raw = process.env.UPLOAD_SCANNER_ALLOWED_ORIGINS?.trim();
  if (!raw) {
    return process.env.NODE_ENV === 'production'
      ? { ok: false, code: 'scanner_allowed_origins_missing' }
      : { ok: true, origins: new Set() };
  }

  const origins = new Set<string>();
  for (const item of raw.split(',').map((value) => value.trim()).filter(Boolean)) {
    let candidate: URL;
    try {
      candidate = new URL(item);
    } catch {
      return { ok: false, code: 'scanner_allowed_origins_invalid' };
    }

    if (
      candidate.protocol !== 'https:' ||
      candidate.username ||
      candidate.password ||
      candidate.hash ||
      candidate.search ||
      candidate.pathname !== '/'
    ) {
      return { ok: false, code: 'scanner_allowed_origins_invalid' };
    }
    origins.add(candidate.origin);
  }

  if (process.env.NODE_ENV === 'production' && origins.size === 0) {
    return { ok: false, code: 'scanner_allowed_origins_missing' };
  }

  return { ok: true, origins };
}

function productionHostnameBlocked(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  return (
    normalized === 'localhost' ||
    isIP(normalized) !== 0 ||
    BLOCKED_PRODUCTION_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  );
}

function resolveRemoteScannerConfiguration():
  | { ok: true; url: URL; token?: string }
  | { ok: false; code: string } {
  const endpoint = process.env.UPLOAD_SCANNER_URL?.trim();
  if (!endpoint) return { ok: false, code: 'scanner_endpoint_missing' };

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return { ok: false, code: 'scanner_endpoint_invalid' };
  }

  if (url.username || url.password || url.hash || url.search) {
    return { ok: false, code: 'scanner_endpoint_unsafe' };
  }

  const localDevelopmentEndpoint = process.env.NODE_ENV !== 'production' &&
    (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
  if (url.protocol !== 'https:' && !localDevelopmentEndpoint) {
    return { ok: false, code: 'scanner_endpoint_must_use_https' };
  }

  const allowed = parseAllowedOrigins();
  if (!allowed.ok) return allowed;

  if (process.env.NODE_ENV === 'production') {
    if (productionHostnameBlocked(url.hostname)) {
      return { ok: false, code: 'scanner_endpoint_private_host_forbidden' };
    }
    if (!allowed.origins.has(url.origin)) {
      return { ok: false, code: 'scanner_origin_not_allowed' };
    }
  } else if (allowed.origins.size > 0 && !allowed.origins.has(url.origin)) {
    return { ok: false, code: 'scanner_origin_not_allowed' };
  }

  const rawToken = process.env.UPLOAD_SCANNER_TOKEN;
  const token = rawToken?.trim();
  if (process.env.NODE_ENV === 'production' && !token) {
    return { ok: false, code: 'scanner_token_missing' };
  }
  if (
    rawToken &&
    (rawToken !== token || Buffer.byteLength(rawToken, 'utf8') > MAX_TOKEN_BYTES || /[\u0000-\u001f\u007f]/.test(rawToken))
  ) {
    return { ok: false, code: 'scanner_token_invalid' };
  }

  return { ok: true, url, token: token || undefined };
}

export function validateUploadScannerConfiguration(): UploadScannerConfigurationStatus {
  const mode = (process.env.UPLOAD_SCANNER_MODE || 'remote').trim().toLowerCase();
  if (mode === 'deterministic') {
    return deterministicScannerAllowed()
      ? { ok: true, mode: 'deterministic' }
      : { ok: false, code: 'deterministic_mode_forbidden_in_production' };
  }
  if (mode !== 'remote') return { ok: false, code: 'unsupported_scanner_mode' };

  const resolved = resolveRemoteScannerConfiguration();
  return resolved.ok
    ? { ok: true, mode: 'remote', endpointOrigin: resolved.url.origin }
    : { ok: false, code: resolved.code };
}

function validMimeType(value: string) {
  return /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i.test(value);
}

async function readBoundedResponseText(response: Response) {
  const contentLength = Number.parseInt(response.headers.get('content-length') || '', 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) return null;
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
}

export function sha256Hex(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function scanUploadBytes(
  bytes: Uint8Array,
  context: UploadScanContext,
): Promise<UploadScanResult> {
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_SCANNABLE_BYTES) {
    return unavailable('scanner_payload_size_invalid');
  }

  const mode = (process.env.UPLOAD_SCANNER_MODE || 'remote').trim().toLowerCase();
  if (mode === 'deterministic') {
    if (!deterministicScannerAllowed()) {
      return unavailable('deterministic_mode_forbidden_in_production');
    }
    return deterministicScan(bytes);
  }
  if (mode !== 'remote') return unavailable('unsupported_scanner_mode');

  const configuration = resolveRemoteScannerConfiguration();
  if (!configuration.ok) return unavailable(configuration.code);

  const mimeType = context.mimeType.trim().toLowerCase();
  if (!validMimeType(mimeType)) return unavailable('scanner_mime_invalid');

  const sha256 = sha256Hex(bytes);
  if (context.sha256 && context.sha256.toLowerCase() !== sha256) {
    return unavailable('scanner_sha256_mismatch');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    'X-EntizNetStore-Content-Type': boundedHeaderValue(mimeType, 'application/octet-stream', 100),
    'X-EntizNetStore-SHA256': sha256,
    'X-EntizNetStore-Scanner-Protocol': '1',
    Accept: 'application/json',
  };
  if (configuration.token) headers.Authorization = `Bearer ${configuration.token}`;

  try {
    const response = await fetch(configuration.url, {
      method: 'POST',
      headers,
      body: bytes,
      signal: AbortSignal.timeout(configuredTimeout()),
      cache: 'no-store',
      redirect: 'error',
    });

    if (!response.ok) {
      return unavailable(`scanner_http_${response.status}`, 'remote');
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!/^application\/(?:json|[a-z0-9.+-]+\+json)(?:\s*;|$)/.test(contentType)) {
      return unavailable('scanner_response_content_type_invalid', 'remote');
    }

    const responseText = await readBoundedResponseText(response);
    if (responseText === null) return unavailable('scanner_response_too_large', 'remote');

    const payload = (() => {
      try {
        return JSON.parse(responseText) as {
          verdict?: unknown;
          scanner?: unknown;
          engine?: unknown;
          version?: unknown;
          code?: unknown;
        };
      } catch {
        return null;
      }
    })();
    if (!payload || (payload.verdict !== 'clean' && payload.verdict !== 'blocked')) {
      return unavailable('scanner_response_invalid', 'remote');
    }

    return {
      verdict: payload.verdict,
      scanner: boundedIdentifier(payload.scanner ?? payload.engine, 'remote', 80),
      version: boundedIdentifier(payload.version, 'unknown', 80),
      code: boundedIdentifier(payload.code, payload.verdict === 'clean' ? 'clean' : 'blocked', 120),
    };
  } catch (error) {
    return unavailable(
      error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
        ? 'scanner_timeout'
        : 'scanner_request_failed',
      'remote',
    );
  }
}
