# ADR-0001: Account capabilities, identity, and EntizNet integration

- Status: **Accepted**
- Date: 2026-08-21
- Scope: EntizNetStore identity/authorization architecture

## Context

EntizNetStore must work as a standalone marketplace and as a capability inside EntizNet. A single person may legitimately buy, sell, operate a business/storefront, or hold additional EntizNet capabilities over time. Treating a user as permanently belonging to one mutually exclusive role would conflict with that product model and would make future EntizNet integration brittle.

The existing canonical database already separates buyer and seller data into capability-specific projections (`profiles_buyer`, `profiles_seller`, `profiles_seller_private`) keyed by the Supabase Auth user id. This useful structure should be preserved rather than replaced merely to introduce a generic role column.

## Decision

### 1. One canonical identity, multiple capabilities

`auth.users.id` is the canonical EntizNetStore identity key. Buyer, seller, and future business/store capabilities are additive entitlements/projections attached to that identity; they are not permanent mutually exclusive account types.

A user may therefore have, for example, both a buyer profile and a seller profile without creating a second account.

### 2. Existing profile tables are capability projections

- `profiles_buyer` contains buyer-specific application data.
- `profiles_seller` contains seller/storefront-facing application data.
- `profiles_seller_private` contains private seller/business data and stays separated from public storefront information.

Presence of one projection does not prohibit another projection from existing for the same user id.

### 3. Authorization is server-enforced and state-aware

Access decisions are based on the combination of:

- authenticated identity;
- required capability/projection;
- resource ownership/participation;
- verification or lifecycle state where applicable; and
- privileged operator/admin authorization for administrative actions.

Clients may render capability-aware navigation, but client state, local storage, URL parameters, or UI-selected roles are never authorization sources.

### 4. Admin/operator privilege is separate

Administrative privilege is not a buyer/seller capability and must never be inferred from ordinary marketplace profile data. Admin authorization stays server-side and auditable.

### 5. EntizNet integration respects the repository boundary

EntizNetStore remains a distinct product and repository. EntizNet integration will use a secure contract such as signed APIs, shared capability claims, or auditable events rather than direct cross-product table coupling or duplicated password/identity systems.

The integration contract must map the EntizNet principal to the same canonical EntizNetStore identity and capabilities. Standalone sign-in and EntizNet entry must converge on identical server-side permissions.

### 6. Do not force a speculative schema rewrite

M0 does **not** introduce a new generic `role` column or rewrite the existing profile model. If EntizNet entitlement synchronization later needs a normalized capability registry (for example `account_capabilities`), it will be introduced by a forward migration with an explicit contract and compatibility plan.

### 7. Web and native mobile share authorization contracts

The React Native applications must use the same backend/domain capability checks as the web application. Mobile is not allowed to reimplement a weaker or divergent role model.

## Consequences

### Positive

- A customer can become a seller without creating a new permanent identity.
- EntizNet can grant Store capabilities without conflicting with other Entiz ecosystem capabilities.
- Existing RLS ownership rules continue to use the stable user UUID.
- Sensitive seller data remains segregated.
- Web/mobile authorization can converge on common contracts.

### Costs / follow-up

- Onboarding must be capable of adding capabilities incrementally instead of assuming a one-time permanent role choice.
- EntizNet identity/capability handoff requires a documented secure integration protocol before integration launch.
- Capability grant/revoke events and admin changes require auditability.
- Any future normalized capability registry must remain compatible with the current profile projections.

## Rejected alternatives

### Permanent single `role` per user

Rejected because it prevents legitimate buyer + seller + business combinations and conflicts with EntizNet's multi-capability account model.

### Duplicate EntizNetStore accounts per capability

Rejected because it fragments identity, order history, security controls, and EntizNet integration.

### Directly sharing EntizNet database tables

Rejected because it tightly couples release/security boundaries and duplicates product responsibility. Integration must occur through an explicit secure boundary.
