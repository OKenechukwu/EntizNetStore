# Production upload scanner security contract

Last reviewed: **2026-08-31**

## Purpose

EntizNetStore treats every Buyer/Seller/Business upload as untrusted until it has passed the private quarantine pipeline, byte-signature/MIME validation, SHA-256 fingerprinting and an authenticated malware-scanner verdict. A scanner outage or configuration error must never promote an object.

This document defines the production trust boundary for the remote scanner. It supplements `ENVIRONMENT_SECRETS.md`; real scanner credentials never belong in Git.

## Production configuration

Required server-only configuration:

- `UPLOAD_SCANNER_MODE=remote`
- `UPLOAD_SCANNER_URL=https://scanner-provider.example/path`
- `UPLOAD_SCANNER_ALLOWED_ORIGINS=https://scanner-provider.example`
- `UPLOAD_SCANNER_TOKEN=<server secret>`
- optional `UPLOAD_SCANNER_TIMEOUT_MS`, bounded by the application to 1–30 seconds

`UPLOAD_SCANNER_ALLOWED_ORIGINS` is an explicit comma-separated allowlist of exact HTTPS origins. Entries are origins only: no path, query string, fragment or embedded credentials. Production refuses scanner calls if the configured endpoint origin is not on this list.

## Destination and SSRF controls

Production remote scanning fails closed when:

- the scanner endpoint is missing or cannot be parsed;
- it is not HTTPS;
- it contains URL credentials, a query string or a fragment;
- the hostname is localhost, an IP literal, or an explicitly private/local hostname suffix;
- the allowlist is missing, malformed or does not contain the endpoint origin;
- the bearer token is missing, contains control characters/outer whitespace or exceeds the bounded header size.

The origin allowlist is the primary egress pin. Scanner credentials and private upload bytes must not be sent to a destination selected from request/user data.

## Request contract

The scanner receives only the validated object bytes and bounded protocol metadata:

- body: `application/octet-stream`;
- `Authorization: Bearer <scanner token>`;
- `X-EntizNetStore-Content-Type`: verified MIME type;
- `X-EntizNetStore-SHA256`: SHA-256 recomputed from the exact transmitted bytes;
- `X-EntizNetStore-Scanner-Protocol: 1`;
- `Accept: application/json`.

The application does **not** send the user's filename, Storage path, signed URL, account identifier, KYC identifier, message identifier or product identifier to the scanner. If a caller supplies a SHA-256 context that differs from the transmitted bytes, scanning fails before any network request.

The scanner function independently refuses empty payloads and payloads above the platform quarantine ceiling (15 MiB), even though upstream upload initialization/finalization already enforces purpose-specific limits.

## Response contract

A successful scanner response must:

- be HTTP 2xx;
- declare `application/json` or an `application/*+json` media type;
- fit within the 16 KiB response ceiling while streaming;
- parse as JSON;
- contain exactly an accepted authoritative verdict: `clean` or `blocked`.

Only bounded, identifier-sanitized `scanner`, `version` and `code` metadata are retained. Free-form provider messages/payloads are not persisted or logged. Unknown verdicts, malformed JSON, oversized bodies, wrong content types, redirects, timeouts, transport failures and non-2xx responses become `unavailable` and therefore fail closed in quarantine.

## CI and test behavior

`UPLOAD_SCANNER_MODE=deterministic` exists only for local/CI regression. It recognizes the standard EICAR test signature to exercise blocked-file behavior without shipping executable malware. Ordinary production rejects deterministic mode.

The unit suite must cover at minimum:

- production deterministic-mode rejection;
- missing endpoint/allowlist/token rejection;
- HTTPS enforcement;
- origin drift rejection;
- IP/private-host refusal;
- query/embedded-credential/fragment refusal;
- clean and blocked remote verdicts;
- digest mismatch refusal before network activity;
- invalid content type and malformed/oversized response refusal;
- timeout fail-closed behavior;
- omission of raw filenames/private object identifiers from scanner headers.

## Launch gate

The engineering contract alone does not clear P0-05. Before public uploads are enabled, an approved scanner provider must be provisioned in a production-like environment and verified through the real quarantine flow with disposable clean/EICAR fixtures plus scanner outage/timeout behavior. Production secrets must be owned and rotatable, and the marketplace upload/content moderation policy must be approved.
