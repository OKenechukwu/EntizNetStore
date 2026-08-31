# EntizNetStore Monetization Roadmap

Last updated: 2026-08-29

## Product decision

EntizNetStore uses two distinct advertising models and they must not be conflated.

### V1 — third-party adult-friendly publisher advertising

V1 may monetize eligible EntizNetStore traffic through established third-party adult-friendly advertising networks. The current shortlist is:

1. ExoClick
2. TrafficJunky
3. JuicyAds

All three providers may be integrated concurrently, subject to individual publisher approval and current provider policies. Concurrent integration does **not** mean blindly loading every provider into every slot on every page. EntizNetStore will own a central ad-routing layer that can assign, rotate, compare, fall back between, or disable providers per placement, device, geography and page class.

The V1 goal is publisher monetization without building an internal advertiser marketplace. Integration must be isolated behind an ad-provider abstraction so providers can be enabled, disabled, rotated, geo/page-restricted, or performance-ranked without coupling ad code to marketplace commerce.

#### Multi-network revenue strategy

EntizNetStore should maximize **total business value**, not raw ad impressions. The ad router should support:

- concurrent provider support for ExoClick, TrafficJunky and JuicyAds;
- different providers in different slots on the same eligible page when policy and UX allow;
- weighted traffic allocation and A/B testing by placement, country, device and page type;
- provider fallback for unfilled or unavailable inventory where provider APIs/tags support a reliable fallback contract;
- per-provider and per-slot configuration so a weak-performing network can be reduced or disabled without redeployment;
- frequency limits and page-level ad-density limits;
- performance telemetry for impressions, viewability where available, clicks, fill rate, eCPM/RPM, revenue per session and page latency;
- marketplace guardrail metrics including bounce rate, product-view depth, add-to-cart rate and checkout conversion so ad revenue never silently destroys higher-value commerce revenue;
- periodic allocation optimization based on observed net revenue rather than assumptions about which network will pay best.

The preferred launch posture is conservative: high-quality display/native placements on discovery/content surfaces first. Aggressive pop, pop-under, forced redirect, exit-interstitial or similarly disruptive formats are not required for V1 and should remain disabled unless later testing demonstrates clear incremental value without harming trust, marketplace conversion, provider compliance, accessibility or browser stability.

V1 implementation requirements:

- provider configuration remains server/environment controlled;
- ad slots are explicit, responsive, lazy-loaded where practical, and non-blocking;
- ads must never interfere with checkout, authentication, KYC, Seller/BSM administration, payments, messaging, account security, trust/safety or age-verification flows;
- no provider script may receive Supabase credentials, auth tokens, checkout state, KYC data, messages, private profile data or other private marketplace data;
- consent/privacy requirements and geo restrictions must be respected;
- CSP and third-party script permissions must be narrowly scoped to approved provider origins;
- provider failures must fail open for page rendering but fail closed for private-data exposure;
- ads must be removable globally and per provider/slot through configuration without a redeploy where practical;
- the router must prevent duplicate slot rendering, cumulative layout shift and uncontrolled script injection;
- production monitoring must distinguish ad-provider failures from core marketplace failures;
- launch integration requires provider account approval and current publisher-policy review before enabling production traffic.

#### Launch placement principles

Eligible V1 ad surfaces may include public home/discovery/catalogue pages, category pages, public product browsing, public BSM/wholesale discovery and selected editorial/help surfaces where an ad does not interfere with the primary task.

Ads should be excluded from sensitive or conversion-critical surfaces including sign-in/registration, onboarding, KYC, account/security settings, Seller/BSM management dashboards, Admin, messaging, cart, quote, checkout, payment/refund/dispute flows and other private operational pages.

Ad density must remain materially below provider maximums and must preserve a content-first marketplace experience. Provider-specific hard limits are ceilings, not EntizNetStore targets.

### V2 — EntizNetStore Sponsored / Promoted Products

The first-party sponsored-advertising marketplace is explicitly deferred to V2.

V2 may allow Sellers and Business/BSM participants, including Brands, Suppliers, Manufacturers, Distributors, and Wholesalers, to pay EntizNetStore to promote retail products or wholesale offers to relevant buyers and retailers.

Likely V2 capabilities include:

- sponsored product and wholesale-offer campaigns;
- targeting by category, geography, Business/retailer context, and marketplace relevance;
- budgets, schedules, spend ledger and billing;
- clearly labelled Sponsored placements;
- impression, click, add-to-cart, order and attributable-sales analytics;
- campaign moderation and policy controls;
- ranking/auction optimisation only after sufficient marketplace traffic exists.

## Why first-party sponsored ads are deferred

At V1 launch, marketplace liquidity and user acquisition are more important than building an internal advertising economy. The platform should first accumulate meaningful numbers of shoppers, retailers, Sellers and Business/BSM participants. Building campaign billing, targeting, ranking, analytics, moderation and attribution before that liquidity exists would consume launch capacity without providing proportional value.

Accordingly, V1 prioritises core marketplace commerce + BSM wholesale + external publisher monetization. The EntizNetStore-owned sponsored advertising platform begins in V2 after sufficient marketplace activity exists to make promotion valuable to advertisers.
