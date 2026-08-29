# EntizNetStore Monetization Roadmap

Last updated: 2026-08-29

## Product decision

EntizNetStore uses two distinct advertising models and they must not be conflated.

### V1 — third-party adult-friendly publisher advertising

V1 may monetize eligible EntizNetStore traffic through established third-party adult-friendly advertising networks. The current shortlist is:

1. ExoClick
2. TrafficJunky
3. JuicyAds

The V1 goal is lightweight publisher monetization without building an internal ad marketplace. Integration must be isolated behind an ad-provider abstraction so providers can be enabled, disabled, rotated, or geo/page-restricted without coupling ad code to marketplace commerce.

V1 implementation requirements:

- provider configuration remains server/environment controlled;
- ad slots are explicit, responsive, and non-blocking;
- ads must never interfere with checkout, authentication, KYC, Seller/BSM administration, payments, or trust/safety flows;
- no provider script may receive Supabase credentials, auth tokens, checkout state, KYC data, messages, or other private marketplace data;
- consent/privacy requirements and geo restrictions must be respected;
- CSP and third-party script permissions must be narrowly scoped to the selected provider;
- provider failures must fail open for page rendering but fail closed for private-data exposure;
- ads must be removable globally through configuration without a redeploy where practical;
- launch integration requires provider account approval and current publisher-policy review before enabling production traffic.

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
