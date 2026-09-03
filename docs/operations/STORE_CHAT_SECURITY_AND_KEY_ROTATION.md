# Store Chat Security, Encryption and Key Rotation

Status: production release contract for the canonical EntizNetStore messaging boundary.

## Security model

Store Chat is a marketplace conversation system, not an arbitrary user-to-user UUID messenger.

A conversation is opened from an authoritative commerce context:

- `product` — an active, approved product owned by a verified active Seller;
- `storefront` — a verified active Seller storefront;
- `order` — an order whose Buyer/Seller relationship is authoritative;
- `wholesale_offer` — an active wholesale offer between a verified Business Buyer and verified Business/Seller supplier.

The client never chooses the canonical recipient. The database derives both participants and their contextual roles. Roles are additive and contextual (`shopper`, `seller`, `business_buyer`, `business_supplier`) and do not replace the account's broader Buyer/Seller/Business capability model.

## Data API authority boundary

The stable public RPCs are:

- `public.open_store_conversation(text, uuid)`;
- `public.send_store_message(uuid, text, text, text, text)`;
- `public.mark_store_conversation_read(uuid)`.

These public RPCs are `SECURITY INVOKER` wrappers. Their privileged implementations live in the non-exposed `app_private` schema as reviewed `SECURITY DEFINER` functions with pinned search paths and explicit role grants.

Browser roles:

- may execute only the reviewed public wrappers;
- may select conversations/messages only through participant RLS;
- cannot insert/update/delete conversations or messages directly;
- cannot read or write conversation key envelopes;
- cannot call the retired recipient-addressed plaintext sender;
- cannot retrieve a conversation by another user's UUID.

`anon` receives no Store Chat RPC execution authority.

## Canonical message and translation invariant

`messages.content` contains the encrypted canonical original message. The original is immutable presentation authority for misunderstandings, moderation, disputes, refunds, safety review and legal/audit workflows.

Future translations must never overwrite the canonical original. A translation is a derived representation/cache tied to the original message plus target language and provider/model/version metadata. Translation provider failure must never block delivery of the original message.

Plaintext message bodies and translated bodies must not be written to operational logs.

## Encryption model

Each conversation receives an independent random 256-bit data-encryption key (DEK).

Message bodies are encrypted with AES-256-GCM and conversation-bound additional authenticated data (AAD). Moving ciphertext to another conversation therefore fails authentication rather than decrypting successfully.

The conversation DEK is never stored raw. It is wrapped with AES-256-GCM under a server-only key-encryption key (KEK), also with conversation-bound AAD.

Physical wrapped-key persistence reuses the existing deny-by-default `public.conversation_keys` table after removing its legacy raw-key semantics. Application code addresses a service-role-only `public.message_key_envelopes` `security_invoker` view. `anon` and `authenticated` have no privileges on either key surface.

## Environment variables

Preferred dedicated message KEK:

- `MESSAGE_KEY_ENCRYPTION_KEY` — high-entropy server-only secret material;
- `MESSAGE_KEY_ENCRYPTION_KEY_ID` — stable non-secret identifier for that exact key material.

Rotation-only previous key:

- `MESSAGE_KEY_ENCRYPTION_KEY_PREVIOUS`;
- `MESSAGE_KEY_ENCRYPTION_KEY_PREVIOUS_ID`.

Controlled rollout fallback candidates are `SUPABASE_SECRET_KEY` and then legacy `SUPABASE_SERVICE_ROLE_KEY`. These fallbacks exist only so introducing the dedicated message KEK / migrating Supabase server credentials cannot silently orphan envelopes. A dedicated message KEK is required before public chat launch.

No `MESSAGE_KEY_*`, Supabase secret/service-role credential, raw DEK, or wrapped-key plaintext may enter `NEXT_PUBLIC_*`, browser bundles, React Native configuration, logs, analytics, error payloads or client storage.

## Initial production rollout

M5 is an expand/switch release. Before applying it:

1. Confirm the exact candidate head has green CI, Store Chat Security, HTTP/Chromium/WCAG, Image Egress and Product Media gates plus a READY exact-head Vercel Preview.
2. Reconcile repository and live Supabase migration history.
3. Confirm `conversations`, `messages`, `conversation_keys` and `message_attachments` remain empty. The key-surface transition intentionally aborts if legacy/raw key rows appear.
4. Capture the normal production recovery checkpoint required by `PRODUCTION_RELEASE.md`.
5. Apply only the new M5 forward migrations in repository order.
6. Verify grants, RLS, public-wrapper/private-authority function placement, the `message_key_envelopes` view, and zero unexpected anonymous privileges.
7. Confirm the production server has usable server-only wrapping material. Prefer installing the dedicated `MESSAGE_KEY_ENCRYPTION_KEY` and stable ID before enabling real messaging.
8. Only after database verification, merge the exact green application head and verify the exact Vercel production SHA, health and runtime logs.

Do not deploy M5 application code before the database migration it requires.

## KEK rotation

Never rotate by simply replacing the current secret and deleting the old one.

Safe sequence:

1. Generate new high-entropy KEK material outside source control.
2. Keep the currently active KEK and ID unchanged long enough to identify the old envelope population.
3. Install the new key as `MESSAGE_KEY_ENCRYPTION_KEY` with a new stable `MESSAGE_KEY_ENCRYPTION_KEY_ID`.
4. Install the old key and old ID as `MESSAGE_KEY_ENCRYPTION_KEY_PREVIOUS` / `_PREVIOUS_ID` in the same trusted runtime.
5. Redeploy and verify that both old and newly created conversations decrypt successfully.
6. Rewrap every existing conversation envelope under the new primary KEK using a trusted, auditable maintenance path. Rewrapping changes only the wrapped DEK envelope; it must not decrypt/rewrite message bodies unnecessarily.
7. Verify there are zero envelopes whose `kek_id` references the old key.
8. Remove the previous-key environment variables, redeploy and re-verify representative conversations.
9. Revoke/delete the old secret at its secret-management source.
10. Record rotation metadata without storing the secret itself.

Until a rewrap maintenance command is implemented and proven, do not remove a previous/fallback KEK that still owns any envelope.

## Supabase server-key migration interaction

The message crypto adapter may temporarily derive a KEK from `SUPABASE_SECRET_KEY` or legacy `SUPABASE_SERVICE_ROLE_KEY` when no dedicated message KEK exists. Because an envelope records its `kek_id`, adding a new Supabase secret does not make old envelopes silently use a different key.

Before revoking a Supabase credential that has been used as message KEK material:

- install a dedicated message KEK;
- retain the old Supabase credential as an unwrap candidate long enough to rewrap all affected envelopes;
- verify no envelope references its derived key ID;
- then remove/revoke it according to the Supabase key migration runbook.

## Failure and recovery behavior

Missing KEK: fail closed. Do not return ciphertext as if it were plaintext and do not create a replacement key for an existing envelope.

Authentication/tag failure: treat as integrity failure. Do not retry with modified AAD, ignore the tag, or overwrite the message.

Envelope missing for an existing canonical conversation: sending is blocked until a trusted server initializes the envelope. The database write RPC verifies the envelope exists before accepting ciphertext.

Key rotation ambiguity: stop rollout and retain all candidate keys. Never guess which key encrypted an envelope.

Database compromise: wrapped DEKs provide compartmentalization from a database-only disclosure as long as the server KEK is not also compromised. A simultaneous application-secret compromise changes the threat model and requires secret rotation plus incident response.

## Required regressions

The release gate must continue proving:

- no caller-supplied recipient/order authority in Store Chat send;
- public wrappers are invoker-only and anonymous callers cannot execute them;
- private authority functions retain `auth.uid()` binding and pinned search paths;
- direct table writes are denied to browser roles;
- unrelated users cannot read canonical conversations/messages/attachments;
- Auth email is absent from conversation identity payloads;
- ciphertext differs from the canonical plaintext original in database storage;
- AES-GCM tampering and conversation swapping fail authentication;
- wrapped key material is not available to browser roles;
- KEK rotation with a retained previous key can unwrap old envelopes;
- generic notifications contain no message plaintext/ciphertext;
- KYC/product-media/branding/upload regressions remain green alongside messaging changes.

Any relaxation requires an explicit security review and a new forward migration or test change; do not bypass a failing gate to ship messaging.