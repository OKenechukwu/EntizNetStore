# EntizNetStore — Web-First Launch and Native Mobile Sequence

Last reviewed: **2026-08-25**

## Decision

EntizNetStore public V1 launches on the responsive web first.

Native iOS and Android clients remain first-class products, but they are an immediate post-web milestone rather than a blocker for the initial public web launch. The native clients must be real React Native + TypeScript applications (Expo preferred unless repository/platform inspection produces a strong reason otherwise), not WebView wrappers.

## Public web launch contract

The web release must be production-grade on desktop, tablet and phone browsers before it is considered public-launch ready. Web launch includes:

- secure Buyer/Seller/Business identity and capability behavior;
- production-ready catalogue, cart, checkout, order and Seller operations in the approved launch scope;
- responsive mobile-browser usability and accessibility;
- production monitoring, recovery and security gates;
- a visible **Download App** entry in the shared navigation;
- an `/apps` page that accurately reports native app availability;
- no fake App Store or Google Play links before a real approved listing exists;
- deliberate search-indexing activation only when the production launch is intentionally public.

`SITE_INDEXING_ENABLED` is the explicit production switch. It defaults to false so development, preview and staging deployments remain no-index unless intentionally configured otherwise.

## Download App behavior

Before native store releases:

- `Download App` routes to `/apps`;
- `/apps` tells users that the responsive web marketplace is available now;
- iOS and Android are shown as coming soon;
- disabled availability labels must not imitate live store-download links.

After each native app is approved:

- replace the relevant coming-soon state with the official store listing;
- deep-link users to the correct App Store or Google Play destination;
- preserve `/apps` as the stable cross-platform discovery URL;
- never point production users at sideloaded or unpublished consumer builds as the normal download path.

## Native mobile milestone

Native development starts from the web/backend contracts that have survived public-launch verification. Web and mobile share backend/domain contracts and security rules rather than duplicating business logic.

The native foundation should include:

1. React Native + TypeScript, preferably Expo after repository/SDK validation.
2. Secure mobile authentication/session storage and account recovery.
3. Buyer catalogue, search, cart, checkout, order and account flows appropriate to the approved mobile launch scope.
4. Seller operations appropriate to mobile, without weakening KYC or authorization boundaries.
5. Push-notification consent, token lifecycle and account/device revocation.
6. Universal/app links and EntizNet entry-point deep links.
7. Native loading, offline/retry, error and recovery states.
8. Mobile analytics/crash monitoring with the same PII/secret-redaction standard as web.
9. Store-policy content and commerce review before final feature scope is frozen.
10. Separate iOS and Android release checklists, signing, privacy declarations, screenshots/metadata and review evidence.

## Store acceptance is a release gate

App Store and Google Play acceptance must not be assumed merely because the code works. Before native implementation and again before submission, the current Apple and Google policies must be re-audited against EntizNetStore's actual catalogue/content, age gating, payments, account behavior, privacy disclosures and Seller functionality.

If a store policy requires a different native feature boundary from the web product, preserve the canonical backend/security model and make the narrowest policy-compliant client adjustment. Do not weaken the web platform or create contradictory identity/commerce rules solely to mimic a store client.

## Sequence

### Stage A — Public responsive web

Clear all web P0 blockers, production domain/indexing/release controls, responsive/accessibility checks and launch monitoring. Publish the web marketplace with the Download App discovery entry.

### Stage B — Native mobile foundation

Create the shared mobile architecture, Expo/React Native app foundation, secure auth/session layer, shared API/domain contracts and navigation/deep-link model.

### Stage C — Native commerce parity

Implement and verify the approved Buyer/Seller mobile flows against the same Supabase-backed contracts and server-side authorization as web.

### Stage D — Store-review hardening

Audit current Apple/Google policies, privacy declarations, content boundaries, age gating, purchase/payment rules, app permissions, deletion/account controls and release metadata. Fix review blockers without compromising backend authorization.

### Stage E — App Store / Google Play launch

Submit independently, address review findings, verify production store builds, then replace `/apps` coming-soon states with official listing links.

## Non-goals

- Do not delay the public web launch solely because native clients are not yet in stores.
- Do not ship a WebView wrapper and call it the native app.
- Do not duplicate identity, capability, order, payment, inventory or moderation truth into a separate mobile backend.
- Do not advertise an app-store download before a legitimate listing exists.
