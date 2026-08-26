# EntizNetStore web accessibility release gate

Status: launch-gate documentation for the public web V1.

## Purpose

The public web release must be usable on phone, tablet and desktop by keyboard and assistive-technology users. Accessibility findings are product defects: the release gate must not suppress axe rules, ignore known violations, or weaken authorization merely to make CI pass.

## Automated boundary

The HTTP Authorization Regression workflow builds the production Next.js application against a freshly replayed disposable Supabase environment and runs authenticated Chromium verification with isolated Playwright and axe-core tooling.

The accessibility browser regression covers:

- anonymous home, app-download and authentication surfaces;
- Buyer cart, checkout, dashboard, order history, profile and messaging surfaces on a phone viewport;
- Seller dashboard, branding, analytics, verification, storefront and messaging surfaces on a tablet viewport;
- Business/BSM dashboard plus Seller, branding, verification and storefront surfaces using a canonical Business onboarding identity;
- Admin dashboard, accounts, products, KYC, orders, refunds, disputes, finance, trust & safety, catalog, communications and audit surfaces on desktop;
- exactly one `main#main` landmark, no horizontal overflow, no Next.js/browser runtime errors, and a working first-tab `Skip to content` path;
- WCAG 2.x A/AA axe rules on every audited page and on critical dynamic form states.

Disposable authenticated identities use real Supabase sessions and the canonical Buyer, Seller and Business onboarding endpoints. Admin authority is supplied only as trusted auth app metadata in the disposable test environment. Service-role credentials remain inside the Node test process and are never exposed to the browser.

## Critical form and keyboard recovery

The authentication regression additionally verifies that:

- application validation focuses the exact first invalid field;
- invalid controls expose `aria-invalid` and are linked to the visible error alert;
- validation errors remain WCAG AA contrast-compliant on the light authentication card;
- password reveal is keyboard operable and retains focus;
- the address field remains visible in a compact phone viewport approximating an on-screen keyboard;
- address suggestions use combobox/listbox semantics and can be selected with Arrow keys and Enter;
- external address lookup failure remains non-blocking;
- the external address-suggestion response is mocked only inside browser regression so CI does not depend on a third-party geocoder.

## Release rule

A P0 accessibility release PR may merge only when the exact PR head has:

1. full application CI green, including lint, typecheck, production build and fresh-database regression;
2. HTTP Authorization Regression green, including responsive Chromium and WCAG accessibility browser verification;
3. an exact-head Vercel preview in READY state;
4. no unresolved product accessibility failure found by the gate.

After merge, verify the exact production deployment, canonical `/api/health` version and database/storage/operations status, then inspect deployment-scoped runtime errors before recording release evidence.

## Evidence from the P0 critical-flow expansion

The expanded dynamic regression found a real launch defect on the signup validation alert: Tailwind `text-red-600` (`#dc2626`) over the light `bg-gray-200` authentication card (`#e5e7eb`) produced roughly 3.9:1 contrast for 14px normal text, below WCAG AA's 4.5:1 requirement. The product was corrected to `text-red-700` (`#b91c1c`), which provides roughly 5.2:1 contrast on that surface. The axe rule remains enabled.
