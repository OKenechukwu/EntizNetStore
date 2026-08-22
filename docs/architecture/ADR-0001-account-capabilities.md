# ADR-0001: Account capabilities, identity, and EntizNet integration

- Status: **Accepted**
- Date: 2026-08-21
- M1 implementation update: 2026-08-22
- Scope: EntizNetStore identity/authorization architecture

## Context

EntizNetStore must work as a standalone marketplace and as a capability inside EntizNet. A single person may legitimately buy, sell, operate a business/storefront, or hold additional EntizNet capabilities over time. Treating a user as permanently belonging to one mutually exclusive role would conflict with that product model and would make future EntizNet integration brittle.

The canonical database separates capability data into projections keyed by the Supabase Auth user id. This useful structure is preserved rather than replaced by a generic permanent role column.

## Decision

### 1. One canonical identity, multiple capabilities

`auth.users.id` is the canonical EntizNetStore identity key. Buyer, Seller, and Business/BSM capabilities are additive entitlements/projections attached to that identity; they are not permanent mutually exclusive account types.

Buyer is the standalone marketplace baseline. A normal Seller therefore holds Buyer + Seller. A Business/BSM account is a commercial marketplace identity and holds Buyer + Seller + Business/BSM on the same UUID so a brand, supplier, manufacturer, distributor, wholesaler, or retailer is not left with a business profile that cannot actually sell.

### 2. Canonical capability projections

- `profiles_buyer` contains buyer-specific application data.
- `profiles_seller` contains Seller/storefront-facing application data.
- `profiles_seller_private` contains private Seller/business operational data and stays separated from public storefront information.
- `profiles_business` contains the canonical Business/BSM projection for brands, suppliers, manufacturers, distributors, wholesalers, retailers, and other supported business identities.

Presence of one projection does not prohibit another projection from existing for the same user id. Seller onboarding provisions/retains Buyer rather than replacing it. Business/BSM onboarding provisions/retains both Buyer and Seller while adding the Business projection.

The Business projection remains distinct because business identity, public business metadata, and business verification state are not the same concept as generic Seller capability, even though BSM commerce requires Seller capability too.

### 3. Capability lifecycle is server-controlled

Capability creation and verification state transitions are trusted-server operations. Browser-local state may remember an onboarding choice for UX continuity after email verification, but it is never an authorization source.

Seller verification uses an explicit lifecycle:

`pending` → `under_review` → `verified` or `rejected`, with `suspended` reserved for an operator-enforced restriction.

KYC request state is tracked independently so document completeness/review can be represented without overloading the Seller profile.

Business/BSM uses the same canonical KYC evidence as its Seller projection but requires the registered-business document set. Transitional and final verification state is synchronized to `profiles_business`; final Seller + Business decisions and the audit row are committed atomically.

If an already-verified individual/creator Seller adds Business/BSM, the entity type has materially changed. The Seller is converted to business type and business-grade KYC is required again rather than inheriting an individual verification decision.

### 4. Authorization is server-enforced and state-aware

Access decisions are based on the combination of:

- authenticated identity;
- required capability/projection;
- resource ownership/participation;
- verification or lifecycle state where applicable; and
- privileged operator/admin authorization for administrative actions.

Clients may render capability-aware navigation, but client state, local storage, URL parameters, `user_metadata`, or UI-selected roles are never authorization sources.

### 5. Admin/operator privilege is separate

Administrative privilege is not a Buyer/Seller/Business capability and must never be inferred from ordinary marketplace profile data. Admin authorization is derived from trusted identity metadata on the server and privileged mutations are auditable.

### 6. EntizNet integration respects the repository boundary

EntizNetStore remains a distinct product and repository. EntizNet integration will use a secure contract such as signed APIs, shared capability claims, or auditable events rather than direct cross-product table coupling or duplicated password/identity systems.

The integration contract must map the EntizNet principal to the same canonical EntizNetStore identity and capabilities. Standalone sign-in and EntizNet entry must converge on identical server-side permissions.

M1 intentionally establishes the EntizNet-compatible capability semantics without prematurely coupling EntizNetStore to EntizNet's database. The concrete cross-product identity handoff remains a separate P0 integration gate.

### 7. Do not force a speculative generic capability table

M1 does **not** introduce a generic `role` column or a speculative `account_capabilities` registry. The canonical profile projections already provide concrete, typed capability state. If EntizNet entitlement synchronization later needs a normalized registry, it will be introduced by a forward migration with an explicit synchronization/compatibility contract.

### 8. Web and native mobile share authorization contracts

The React Native applications must use the same backend/domain capability checks as the web application. Mobile is not allowed to reimplement a weaker or divergent role model. The M1 API contracts are therefore designed around the authenticated principal rather than browser-specific identity fields.

## Consequences

### Positive

- A customer can become a Seller without creating a second account.
- A BSM account can actually sell because Buyer + Seller + Business are provisioned on one UUID.
- Business identity/verification remains explicit instead of being collapsed into a Seller boolean.
- EntizNet can grant Store capabilities without conflicting with other Entiz ecosystem capabilities.
- Existing RLS ownership rules continue to use the stable user UUID.
- Sensitive Seller/KYC data remains segregated.
- Web/mobile authorization can converge on common server contracts.

### Costs / follow-up

- Capability switching/navigation must eventually expose every capability without treating the default post-login destination as the only role.
- EntizNet identity/capability handoff requires a documented secure integration protocol before EntizNet-linked launch.
- Capability grant/revoke/admin changes require auditability.
- Any future normalized capability registry must remain compatible with the current profile projections.

## Rejected alternatives

### Permanent single `role` per user

Rejected because it prevents legitimate Buyer + Seller + Business combinations and conflicts with EntizNet's multi-capability account model.

### Business/BSM without Seller capability

Rejected because the BSM registration surface is a commerce/selling path. A Business projection without Seller capability would authenticate successfully but fail the canonical product APIs that correctly require Seller capability.

### Duplicate EntizNetStore accounts per capability

Rejected because it fragments identity, order history, security controls, and EntizNet integration.

### Directly sharing EntizNet database tables

Rejected because it tightly couples release/security boundaries and duplicates product responsibility. Integration must occur through an explicit secure boundary.
