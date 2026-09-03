# Message Translation Readiness and Dark Launch

## Purpose

Message translation is a derived presentation feature. The encrypted original in
`public.messages` remains the canonical record for users, moderation, disputes,
refunds, safety review and legal/audit workflows. Translation must never overwrite
or become the authoritative copy of a message.

This capability is deliberately shipped in two stages:

1. **Dark foundation** — schema, authorization, encryption, provider boundary,
   concurrency/crash recovery, health/readiness signals and regressions are
   deployed while the launch interlock remains off.
2. **User exposure** — Translate / Show original controls are enabled only after a
   production provider probe and exact-deployment verification prove the dark
   foundation and its dependencies are healthy.

`MESSAGE_TRANSLATION_LAUNCH_ENABLED=false` is therefore the safe default.

## Authorization contract

`POST /api/messages/translate` accepts only a message UUID and target language.
It does not accept a recipient, seller, order or conversation authority supplied
by the caller.

The route authenticates the caller and reads the canonical message through the
normal user-scoped Supabase client first. Existing message RLS must prove that the
caller is a conversation participant before any server-only key or translation
cache is touched. Missing and inaccessible messages both remain non-actionable to
the translation provider.

The cache table `public.message_translations` is intentionally in the API schema
only because the trusted server Supabase client needs direct access. It has RLS
enabled, no browser policies, explicit privilege revocation from `public`, `anon`
and `authenticated`, and explicit service-role access. Browser code never reads
the table directly.

## Canonical-original integrity

No `original_text`, `translated_text` or equivalent plaintext column is stored.

For each translation request the server:

1. decrypts the canonical original using the existing per-conversation DEK;
2. derives a purpose-separated integrity key with HKDF-SHA256;
3. computes an HMAC-SHA256 digest over message identity, canonical encryption
   version and original plaintext;
4. uses that keyed digest as part of the cache identity and translation AAD.

A raw SHA-256 plaintext hash is intentionally not used because short messages can
be susceptible to offline dictionary guessing if a database snapshot is exposed.

Translation ciphertext uses a separate HKDF-derived AES-256-GCM key and AAD bound
to conversation ID, message ID, target language, provider identity, provider
version and the keyed original-integrity digest. A cached translation cannot be
moved to another message, target language or provider/version without
authentication failure.

If cached ciphertext fails authenticated decryption, the row is not silently
deleted. It is moved to a failed/cooldown state while its persisted evidence is
retained, then becomes eligible for a controlled retry using the same stable
provider idempotency identity.

## Provider egress and idempotency contract

Production remote translation is fail-closed:

- exact HTTPS origin allowlist;
- endpoint credentials/query/fragment rejected;
- localhost, literal IP addresses and private-style host suffixes rejected;
- server-only bearer token;
- redirects rejected;
- `no-store` requests;
- bounded 1–20 second timeout;
- bounded 32 KiB response;
- JSON content type and shape required;
- provider identifiers/version bounded and configured server-side;
- deterministic provider allowed only for local/CI regression.

The remote gateway contract is protocol **v2** and idempotency is mandatory. The
stable `message_translations.id` UUID is sent as both `Idempotency-Key` and
`X-EntizNetStore-Translation-Idempotency-Key`, and as the JSON `requestId`. The
gateway must deduplicate retries for that identity and echo the exact `requestId`
in a successful response. A response that does not acknowledge the exact identity
is rejected.

This closes the normal lease-only crash window: if a provider completes but the
application crashes, times out while the provider continues, or fails to persist
the encrypted result, stale-lease recovery reuses the same cache row UUID instead
of creating a new external request identity. Provider adapters that cannot prove
idempotent retry semantics must not be approved for production launch.

Provider errors are converted to bounded internal diagnostic codes. Original
message read/send behavior does not depend on provider availability and plaintext
is never included in operational diagnostics.

## Cost, concurrency and crash recovery

The cache has a unique identity over message, target language, provider,
provider-version and keyed original digest. Provider work is protected by a
database-backed claim token and lease.

The first request creates the pending claim. Concurrent requests encounter the
unique row and return pending rather than calling the provider again. A crashed
worker can be recovered only after the lease expires. Conditional update semantics
prevent a second worker from stealing an active lease. Crucially, takeover updates
the existing row rather than replacing it, preserving the provider idempotency UUID
across every retry. Provider failures enter a short retry cooldown rather than
permanently poisoning the cache.

## Health and launch readiness

Core `/api/health` status remains based on database, storage, operational-event and
payment health. Optional features are reported independently under `launchGates`:

- `storeChat`: configured only when a dedicated message KEK is present and valid;
- `messageTranslation`: configured only when the provider configuration validates,
  the explicit translation launch interlock is enabled, **and the live encrypted
  translation cache is readable from the trusted server boundary**.

An environment flag by itself therefore cannot make health report translation as
ready before its database dependency exists. A blocked optional feature must not
make browsing or checkout globally unhealthy.

## Promotion gate

Do not expose Translate / Show original until all of the following are true:

- exact-head CI and Message Translation Security workflows are green;
- fresh migration replay and translation structural/adversarial SQL pass;
- crash-safe provider idempotency protocol tests pass;
- Vercel Preview is READY at the exact head;
- production migration is applied and hosted advisors show no new unsafe surface;
- dedicated Store Chat KEK readiness is configured;
- remote translation provider configuration is installed;
- the provider gateway proves stable-idempotency replay behavior, including a
  simulated lost-response/retry case;
- a synthetic production translation probe succeeds without logging plaintext;
- the exact production deployment is healthy with no warning/error/fatal logs;
- browser/WCAG tests for Translate / Show original pass.

If any dependency regresses after launch, translation must fail independently and
leave the canonical original available.