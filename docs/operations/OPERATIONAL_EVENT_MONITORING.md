# Operational Event Monitoring

Last reviewed: 2026-08-25

## Purpose

EntizNetStore records a minimal private signal for repeated production infrastructure failures so the production monitor can distinguish an isolated customer error from a recurring operational incident.

The ledger is **not** an application audit log and must never become a copy of provider error payloads, KYC metadata, Storage paths, signed URLs, payment payloads, request bodies, access tokens or user identifiers.

## Data boundary

`app_private.operational_events` is outside the exposed public API schema, has RLS enabled, has no client policies, and is written/read only through service-role-only SECURITY DEFINER RPCs.

Persisted fields are limited to:

- event name;
- component;
- operation;
- severity (`warning`, `error`, `critical`);
- optional bucket name;
- optional route name;
- optional 16-character SHA-256 actor fingerprint;
- optional 16-character SHA-256 record fingerprint;
- optional bounded provider error code;
- optional HTTP-like status code;
- occurrence timestamp.

There is deliberately no column for raw error messages, provider payloads, URLs, Storage paths, filenames, UUIDs, tokens, assertions, KYC contents or arbitrary JSON metadata.

## Application flow

Sensitive Storage/KYC routes call `reportOperationalError()` only on infrastructure, persistence or lifecycle failures. The helper:

1. creates the same redacted structured record already emitted to runtime logs;
2. fingerprints actor/record identifiers before persistence;
3. rejects ordinary 4xx client-caused failures from ledger persistence so a user cannot manufacture a sitewide incident by repeating an invalid or incomplete request;
4. allows an explicitly `critical` event to override that filter when an application invariant requires escalation;
5. writes only the safe subset through `public.record_operational_event(...)`;
6. treats ledger persistence as best-effort and never masks the original API error;
7. emits a redacted warning if the observability write itself fails, without recursively attempting another ledger write.

Client validation errors, authorization failures and normal 4xx business outcomes therefore remain redacted runtime diagnostics but are not operational-health events.

## Alert threshold

`public.operational_event_health(15, 5)` groups persisted `error` and `critical` events by event name and component for the previous 15 minutes.

- fewer than five matching failures: `ok`;
- five or more matching failures: `degraded`.

The public readiness response exposes only `checks.operations = ok | degraded | unavailable`. It does not disclose the event name, count, actor fingerprint or record fingerprint.

The canonical production smoke requires database, Storage and operations readiness to all be `ok`. The GitHub `Production Monitor` runs that smoke every 15 minutes. A degraded signal therefore enters the same incident creation/recovery workflow as other production-readiness failures.

## Retention

Operational event rows are retained for at most 30 days. `record_operational_event(...)` opportunistically deletes rows older than 30 days on every successful write. The timestamp index keeps that cleanup bounded while event volume is modest.

If production event volume grows materially, replace opportunistic cleanup with an owned scheduled retention job before removing this mechanism.

## Incident handling

When the operational check is degraded:

1. use the GitHub monitor run and Vercel/Supabase aggregate logs to identify the affected component;
2. do not paste KYC documents, signed URLs, credentials, assertions, payment payloads or raw provider responses into GitHub issues;
3. inspect only the minimum provider/service telemetry needed to isolate the fault;
4. apply containment from `docs/operations/INCIDENT_RESPONSE.md`;
5. verify `/api/health` returns HTTP 200 with `database=ok`, `storage=ok`, and `operations=ok` before declaring recovery.

## Known limits

This mechanism detects repeated application-observed failures. It is not a replacement for:

- malware/content scanning;
- payment-provider reconciliation and webhook alerts;
- payout-provider reconciliation alerts;
- EntizNet signed-handoff monitoring after production signing configuration is enabled;
- an external log drain/SIEM when the public-launch operating model requires one;
- durable database/Storage backups.
