# M1 — Identity, Seller, KYC & Storage

Last updated: **2026-08-22**

## Goal

A brand-new EntizNetStore user must be able to establish Buyer identity, add Seller capability, complete Seller verification, and use marketplace storage without depending on Replit infrastructure. The architecture must also support sell-capable Business/BSM identity and remain compatible with future EntizNet account integration.

## Canonical identity model

`auth.users.id` is the stable identity key.

Capability projections:

- Buyer → `profiles_buyer`
- Seller → `profiles_seller`
- Seller private data → `profiles_seller_private`
- Business/BSM → `profiles_business`
- Admin/operator → trusted identity metadata, separate from marketplace capabilities

Buyer is the standalone marketplace baseline. A normal Seller holds Buyer + Seller. A Business/BSM account holds Buyer + Seller + Business/BSM on the same UUID so the business can use canonical Seller product/order APIs without creating another account or relying on a weaker special-case authorization path.

There is no permanent mutually exclusive user role in the authorization model.

## Registration and onboarding

Initial registration may remember a Buyer/Seller/BSM choice client-side only to resume onboarding after email verification. Once authenticated, trusted `/api/onboarding/*` endpoints derive the user from the server session and create capability projections.

Seller onboarding:

1. Ensure Buyer baseline exists.
2. Create Seller projection if absent.
3. Create private Seller projection if absent.
4. Initialize one KYC verification request with required documents based on seller type.
5. Continue to the secure Seller verification experience.

Business/BSM onboarding:

1. Ensure Buyer baseline exists.
2. Create Business/BSM projection if absent.
3. Create/retain Seller projection on the same UUID using business seller type.
4. Create/retain private Seller projection.
5. Initialize or upgrade KYC to the registered-business document set.
6. Continue directly to secure business-grade verification.

If an existing individual/creator Seller adds BSM, the Seller entity becomes business type and must satisfy the business KYC set before inheriting business verification. This prevents an individual identity check from silently becoming a verified company identity.

The `/seller/apply` and `/bsm/apply` routes support adding capabilities later to an existing account.

## Seller and Business verification lifecycle

Seller/Business capability status:

- `pending`
- `under_review`
- `verified`
- `rejected`
- `suspended`

KYC request status:

- `pending`
- `incomplete`
- `under_review`
- `needs_information`
- `approved`
- `rejected`

For individual/creator Sellers, the current required set is identity + address proof. For registered-business Sellers and Business/BSM, the required set is identity + business license + tax document + address proof.

Uploading only part of the required set keeps the capability pending. Once all required document types are submitted, the KYC request and eligible Seller/Business projections move to `under_review`. Rejected accounts can resubmit. Extra uploads never silently downgrade verified or suspended capabilities.

Final admin approval/rejection synchronizes Seller and Business/BSM state in the same database transaction whenever the Business projection exists.

## KYC storage and authorization

Bucket: `kyc-documents`

- private
- 10MB object limit
- PDF/JPEG/PNG/WebP allow-list
- seller-scoped object paths
- upload initialization requires authenticated Seller capability
- browser metadata, MIME, and claimed size are not trusted
- registration re-downloads the private object through the trusted server, verifies actual size, and detects supported formats from magic bytes
- invalid uploads are rejected and removed
- Seller document viewing uses a short-lived signed URL after ownership verification
- KYC metadata tables expose authenticated own-row reads only; mutations are server/service-role controlled

No Replit object storage is required.

## Product media

Bucket: `product-media`

- public storefront media
- 10MB image limit
- JPEG/PNG/WebP
- signed seller-scoped upload initialization
- product save re-downloads every referenced object and verifies seller ownership, actual object existence, size, and image signature before database commit
- removed/deleted product media is cleaned from Storage

## Seller branding

Bucket: `seller-branding`

- public storefront branding
- 5MB image limit
- JPEG/PNG/WebP
- authenticated Seller required
- server receives multipart upload, validates actual bytes/signature, writes to seller-scoped path, then updates `logo_url`/`banner_url`
- new object is removed if database persistence fails
- prior seller-owned branding object is cleaned on replacement

## Message attachments

Bucket: `message-attachments`

- private
- 15MB limit
- PDF/JPEG/PNG/WebP only
- executables, archives, scripts, arbitrary binary formats, and office macro formats are not accepted
- only the original message sender can upload an attachment for that message
- metadata is registered after successful object upload; object is removed if metadata persistence fails
- only the message sender or recipient can mint a short-lived download URL
- `message_attachments` metadata RLS independently limits reads to message participants

The allow-list + magic-byte strategy is a strong unsafe-file reduction control but is not represented as antivirus scanning. A dedicated malware/content scanning provider can be inserted before files become usable if launch policy requires it.

## Admin KYC workflow and auditability

Admin HTTP routes require trusted server-side admin authorization. Document approval/rejection and final Seller/Business approval/rejection call service-role-only `SECURITY DEFINER` functions whose execute grants are revoked from `anon` and `authenticated`.

The database locks the target row and performs the state mutation plus `admin_audit_logs` insertion in one transaction. A reviewed document/finalized request cannot be silently overwritten. Final approval fails closed until every required document type has an approved submission.

When the seller also has Business/BSM capability, the final Seller and Business verification states are synchronized atomically and the audit metadata records that the business projection was updated.

The audit table is not browser-readable or browser-writable.

## RLS and database invariants

M1 canonical database baseline:

- 31 public tables
- RLS enabled on all 31
- 9 intentional no-policy tables that deny browser access by default
- scoped own-row KYC metadata policies
- scoped message attachment participant policy
- Business/BSM own/unverified visibility with verified public identity visibility
- no broad `storage.objects` write policy

Fresh-database CI verifies the table set, RLS count, storage buckets, supporting indexes, grants, privileged RPC execution boundaries, and hardened function search paths.

Regression coverage:

- `scripts/test-m1-identity-kyc-storage.sql` verifies multi-capability coexistence, cross-seller KYC isolation, no direct browser KYC mutation, Business/BSM visibility boundaries, service-role-only KYC admin functions, required-document gating, and atomic audit records.
- `scripts/test-m1-bsm-verification.sql` verifies Buyer + Seller + Business coexistence for BSM and proves final business KYC approval synchronizes Seller + Business + KYC request + audit evidence atomically.
- CI also re-runs the existing commerce, authorization, payment, payout, concurrency, dependency, TypeScript and production-build gates so M1 cannot regress prior milestones.

## Deployment verification

The PR branch is deployed through the dedicated EntizNetStore Vercel project, not through Replit. Preview deployments are required to reach Vercel `READY`, and final merge requires the PR CI workflow to pass production foundation, type-check, build, dependency audit, fresh Supabase reproduction and all regression suites.

## EntizNet boundary

M1 aligns EntizNetStore with EntizNet's multi-capability account direction but deliberately does not directly share EntizNet database tables or passwords. The future EntizNet entry flow must use an explicit signed identity/capability contract and converge on the same EntizNetStore UUID/permissions.

That cross-product handoff remains tracked independently as P0-08.

## Milestone exit gate

**Exit gate:** a brand-new user can become a Seller without any Replit infrastructure.

The gate is satisfied when repository migrations reproduce the identity/KYC/storage architecture from a fresh database, Seller/BSM onboarding compiles and deploys through Vercel, secure KYC can be initialized entirely through Supabase-backed APIs/storage, and CI proves the authorization/state invariants.

M1 completion does **not** mean the whole marketplace is launch-ready. The independent P0/P1 launch blockers remain authoritative.

## Remaining launch-level work after this milestone

M1 does not by itself clear all launch blockers. Remaining work includes broader HTTP/route regression coverage, explicit storage/database partial-failure exercises, final malware/content moderation policy, observability/alerts, durable production backup/restore, external payment/payout provider verification, EntizNet handoff, deployment hardening, and first-class native mobile delivery.
