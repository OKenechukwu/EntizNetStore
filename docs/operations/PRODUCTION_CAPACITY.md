# EntizNetStore Production Capacity Verification

Last reviewed: **2026-09-01**

This runbook defines the bounded production read-capacity gate used by P0-06. It is deliberately conservative. It is not a general-purpose load-testing harness and must not be expanded into write traffic or high-volume stress testing without an explicit operational review.

## Purpose

Before public launch, EntizNetStore needs evidence that the deployed web/runtime/database path remains healthy under a declared read-concurrency envelope. The gate measures:

- total requests and failures;
- failure percentage;
- suite duration;
- observed requests/second;
- p50, p95, p99 and maximum latency;
- exact deployed Git version.

It exercises only the canonical production root and readiness endpoint. It does not create users, carts, orders, payments, payouts, KYC records, messages, uploads, wholesale offers or other mutable data.

## Safety controls

The implementation is split between:

- `.github/workflows/production-capacity.yml` — operator gate and production binding;
- `scripts/test-production-read-capacity.mjs` — bounded read-only probe.

The following controls are mandatory and frozen by `scripts/verify-actions-foundation.mjs`:

1. **Manual dispatch only.** The workflow must not gain `schedule`, `push` or `pull_request` triggers.
2. **Main only.** The job runs only when `github.ref == 'refs/heads/main'`.
3. **Explicit confirmation.** The operator must enter `RUN_READ_ONLY_CAPACITY_GATE`.
4. **Canonical origin binding.** Production target and expected origin are both `https://entiznetstore.vercel.app`.
5. **Exact release binding.** `CAPACITY_EXPECTED_SHA=${{ github.sha }}` requires `/api/health.version` to match the same `main` SHA prefix. A stale deployment fails the gate.
6. **Read-only paths.** Only `GET /` and `GET /api/health` are allowed by the probe implementation.
7. **Bounded volume.** Concurrency is `1..25`; requests per path are `1..250`; maximum possible run is 500 GET requests.
8. **Bounded request time.** The workflow uses an 8-second timeout per request; the script itself allows only 1..30 seconds.
9. **Declared acceptance envelope.** p95 latency and failure percentage limits are inputs, not values silently changed by the probe.
10. **No credentials.** The probe sends no auth cookies, bearer tokens, service-role keys or customer data.

## Default launch rehearsal

Use the default inputs first:

| Input | Default |
| --- | ---: |
| Concurrency | 4 |
| Requests per path | 20 |
| Total requests | 40 |
| Maximum p95 | 2500 ms |
| Maximum failure rate | 1% |
| Per-request timeout | 8000 ms |

These defaults are intentionally a release-safety baseline, not a claim about final marketplace peak capacity.

If the expected launch traffic model requires higher concurrency, define the target before the rehearsal and increase only within the hard caps. If substantially higher load is required, use an approved isolated or vendor load-testing environment instead of weakening these production safety limits.

## Verified production rehearsal — 2026-09-01

A bounded read-only rehearsal was executed against the exact production release `81e31752dc777d12d01a1a6388b69508dfe80df9` (`/api/health.version = 81e31752dc77`). The evidence run used a temporary GitHub Actions branch/workflow that was removed/reset after the result was collected; no product code or temporary workflow was promoted to `main`.

Observed result:

| Metric | Result |
| --- | ---: |
| Paths | `GET /`, `GET /api/health` |
| Concurrency | 10 |
| Requests per path | 100 |
| Total requests | 200 |
| Failures | 0 |
| Failure rate | 0% |
| Throughput | 27.5 requests/sec |
| p50 | 192 ms |
| p95 | 1,597 ms |
| p99 | 1,912 ms |
| Maximum | 1,950 ms |
| Declared maximum p95 | 2,500 ms |
| Result | PASS |

Vercel production deployment for the same release was `READY`, `/api/health` returned HTTP 200 with database, Storage and operations readiness `ok`, and production runtime error telemetry was reviewed with no release-specific error cluster found in the validation window.

This evidence proves the bounded anonymous read path at the tested envelope. It does **not** claim final peak marketplace capacity and does not replace authenticated commerce, payment-provider, storage-upload or seller/admin workload verification.

## Execution

1. Confirm the intended release is already deployed to production and Vercel reports it `READY`.
2. Confirm `/api/health` is currently healthy and its `version` matches `main`.
3. Open GitHub Actions → **Production Read Capacity Gate**.
4. Select the `main` branch.
5. Enter `RUN_READ_ONLY_CAPACITY_GATE` exactly.
6. Set the declared concurrency, requests/path, maximum p95 and maximum failure percentage.
7. Run the workflow once.
8. Preserve the workflow URL, exact Git SHA, inputs and emitted JSON summary as release evidence.
9. Review Vercel runtime errors/logs for the same window before increasing the envelope or declaring the rehearsal successful.

## Passing criteria

The workflow passes only when:

- every non-local production run has an exact expected SHA;
- `/api/health.version` matches that expected SHA prefix;
- failure percentage is less than or equal to the declared maximum;
- p95 latency is less than or equal to the declared maximum.

A version mismatch is classified as a request failure because capacity measurements against a stale deployment are not valid release evidence.

## Failure response

If the gate fails:

1. Do not immediately rerun at a larger envelope.
2. Determine whether the failure is deployment drift, health degradation, latency, HTTP failure or platform/runtime error.
3. Inspect Vercel grouped runtime errors and relevant sanitized logs.
4. Confirm Supabase DB/Storage/operations readiness.
5. Record reproducible evidence in the release/incident record.
6. Fix the underlying issue or explicitly revise the approved launch envelope before rerunning.

Never paste credentials, access tokens, signed URLs, KYC material, customer rows or payment data into workflow logs or GitHub issues.

## Evidence record template

Record:

- date/time UTC;
- exact `main` SHA;
- Vercel production deployment ID;
- workflow run URL;
- concurrency;
- requests per path;
- total requests;
- failure count/percentage;
- p50/p95/p99/max latency;
- throughput;
- declared thresholds;
- Vercel runtime-error review result;
- operator/reviewer;
- pass/fail decision and follow-up.

The bounded production read-capacity evidence is now complete at the 10-concurrency/200-request envelope above. P0-06 as a whole remains `IN PROGRESS` until the owned production domain is configured and verified, repository protection is enabled, final provider-aware environment/CSP review is complete, and rollback is rehearsed on the final launch configuration.
