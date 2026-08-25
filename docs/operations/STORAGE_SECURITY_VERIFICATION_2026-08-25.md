# EntizNetStore Storage Security Verification — 2026-08-25

**Scope:** production Supabase project `kllwwurklumhawfsilpd` plus current application upload/download routes and CI regression coverage.

This record captures the verified Storage boundary for P0-05. It does not mark malware/content scanning complete.

## Live bucket boundary

Production `storage.buckets` was queried directly on 2026-08-25:

| Bucket | Public | File limit | Allowed MIME types |
| --- | --- | ---: | --- |
| `kyc-documents` | no | 10 MB | PDF, JPEG/JPG, PNG, WebP |
| `message-attachments` | no | 15 MB | PDF, JPEG/JPG, PNG, WebP |
| `product-media` | yes | 10 MB | JPEG/JPG, PNG, WebP |
| `seller-branding` | yes | 5 MB | JPEG/JPG, PNG, WebP |

This matches the intended product boundary:

- KYC evidence and conversation attachments are private objects;
- product images and Seller logo/banner assets are intentionally public commerce media;
- executable/script/archive/office-macro formats are not in the bucket allow-lists.

At verification time production contained **0 Storage objects**, so no legacy public object required migration or cleanup.

## Storage RLS posture

`storage.objects` has RLS enabled. The live database currently has no `storage.objects` RLS policies for application roles. This is intentional for the current architecture: normal anonymous/authenticated clients receive no direct row allowance through Storage RLS; object mutation/access is exposed only through narrow application-controlled paths.

The table-level privileges available to `anon`/`authenticated` do not by themselves bypass RLS. With RLS enabled and no matching policy, direct row access is deny-by-default.

## Application access paths

### KYC

- `/api/kyc/upload` requires an authenticated Seller capability before issuing a signed upload URL.
- generated object paths are namespaced by authenticated Seller UUID and document type.
- `/api/kyc/documents` rejects a path that does not start with the authenticated Seller/document prefix.
- registration downloads the private object through the server, verifies actual bytes/size, then creates the database record.
- invalid/oversized uploads are removed best-effort; failed DB registration now also compensates the uploaded object.

### Message attachments

- upload requires authentication and a real message record.
- only the original message sender may attach a file to that message.
- bytes are validated before server-side upload to the private bucket.
- attachment registration failure compensates the uploaded object.
- download requires the authenticated user to be the message sender or recipient and returns a short-lived signed URL rather than making the bucket public.

### Product media

- signed upload initialization requires Seller capability.
- server-generated paths are namespaced by authenticated Seller UUID.
- delete rejects paths outside the authenticated Seller prefix.
- bucket is intentionally public because approved storefront/product media must be directly renderable, while write/delete ownership remains server-controlled.

### Seller branding

- upload requires Seller capability.
- file bytes are validated as real JPEG/PNG/WebP and capped at 5 MB.
- server-generated object paths are namespaced by authenticated Seller UUID and `logo`/`banner` slot.
- profile mutation always targets `user.id`; the caller cannot supply another Seller ID.
- failed profile update compensates the new object and replacement cleanup is observable.

## Regression evidence

- M1 database/storage regression remains part of every fresh-Supabase CI replay.
- PR #11 (`13da45cb77e55d000ddf444bd86c39022289e6dc`) added tested storage/database compensation behavior and merged as `3bf443cd9a5554d02fe9698a545d12b0858d8f99`.
- PR #13 (`9f7a4e9f4f08373c8c10a84589abaf269584a3c5`) established the real HTTP authorization suite against a production-built Next.js app plus fresh Supabase.
- the current P0 storage-completion change expands that suite with Seller storefront self-scope, stable slug verification, cross-Seller KYC/product-media path denial, Seller branding capability checks, spoofed-image rejection and branding ownership verification.

## Remaining security condition

Magic-byte/type/size validation and narrow formats materially reduce attack surface, but they are **not represented as antivirus/malware scanning**.

Before P0-05 can be marked fully verified, EntizNetStore still needs an approved malware/content-scanning policy and implementation appropriate to KYC privacy and message-attachment risk. Any external scanner handling identity documents must be privacy/legal approved; a provider must not receive KYC merely because it is convenient to integrate.

Until that provider/architecture is selected, the current system must continue to reject arbitrary binaries, scripts, archives, macros and unsupported formats rather than weakening validation.
