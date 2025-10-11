# Changelog: Auth Tabs, BSM, Routing, i18n & Currency Fixes

## Summary
Fixed 404s, implemented 3-role auth tabs (Buyer/Seller/BSM), added BSM functionality to footer, fixed routing for profile/notifications, and implemented working language & currency persistence. All changes follow the "no unrelated changes" rule - only touched specified files and functionality.

## ✅ Acceptance Criteria Verified

### 1. Auth Page with Role Tabs ✅
- `/auth` renders with **Buyer / Seller / BSM** tabs for both Sign In and Sign Up modes
- Added **BSM helper text**: "BSM = Brands, Suppliers & Manufacturers" displayed non-intrusively below tabs
- Sign in redirects correctly by role:
  - `buyer` → `/dashboard/buyer`
  - `seller` → `/dashboard/vendor` 
  - `bsm` → `/dashboard/bsm`
- Sign up stores role and redirects using same mapping

**Files modified**: `components/auth/AuthCard.tsx`, `lib/auth/routeByRole.ts`

### 2. Header Profile Icon ✅
- Profile icon now routes based on authentication status:
  - **Not authenticated** → `/auth?mode=signin`
  - **Authenticated** → Correct dashboard by role (buyer/vendor/bsm)
- Implemented as client component with auth check

**Files created**: `components/layout/ProfileIconClient.tsx`
**Files modified**: `components/layout/Header.tsx`

### 3. Notifications Route ✅
- `/notifications` page loads without 404
- Redirects to `/auth?mode=signin` if not signed in
- Header bell already linked to `/notifications` (unchanged)

**Status**: Page already existed with proper auth redirect

### 4. Footer Links - No 404s ✅
All footer links now resolve successfully:
- `/help` - Help Center stub page (200 OK)
- `/privacy` - Privacy Policy (already existed)
- `/terms` - Terms of Service stub page (200 OK)
- `/contact` - Contact stub page (200 OK)

**Seller links** (fixed routes):
- `/seller/apply` - Become a Seller stub page (200 OK) *(was /sell)*
- `/seller/resources` - Seller Resources stub page (200 OK)
- `/dashboard/vendor` - Seller Dashboard *(was /seller/dashboard)*

**Files created**: `app/help/page.tsx`, `app/terms/page.tsx`, `app/contact/page.tsx`, `app/seller/apply/page.tsx`, `app/seller/resources/page.tsx`

### 5. BSM Footer Section ✅
Added new **BSM** column to footer with 3 links:
- "Sell as a Brand, Supplier, Manufacturer (BSM)" → `/bsm/apply` (200 OK)
- "BSM Dashboard" → `/dashboard/bsm` (200 OK)
- "BSM Resources" → `/bsm/resources` (200 OK)

Footer grid updated from 4 to 5 columns (responsive: `md:grid-cols-2 lg:grid-cols-5`)

**Files created**: `app/bsm/apply/page.tsx`, `app/bsm/resources/page.tsx`
**Files modified**: `app/layout-content.tsx` (Footer component)
**Note**: `/dashboard/bsm` already existed

### 6. Language & Currency Pickers ✅
Implemented full persistence and state management:

**Language**:
- Sets both `localStorage.setItem('preferred_language', code)` AND cookie `locale=${code}`
- Triggers `router.refresh()` on change for i18n support
- Persists across page reloads

**Currency**:
- Sets `localStorage.setItem('preferred_currency', code)`
- Triggers `router.refresh()` on change
- Persists across page reloads

**Formatter utility** added to `lib/currency.ts`:
```typescript
export function formatMoney(amount: number, currency = 'USD', locale = 'en-US')
```

**Files modified**: `components/layout/LanguageCurrencyMenu.tsx`, `lib/currency.ts`

### 7. Routing Helpers ✅
Centralized role-based routing in `lib/auth/routeByRole.ts`:
- Added `bsm` role mapping to `/dashboard/bsm`
- Updated `seller` to route to `/dashboard/vendor`
- Used consistently across: auth page, profile icon, all role redirects

**Files modified**: `lib/auth/routeByRole.ts`

### 8. No Layout/Style Changes ✅
Confirmed:
- ✅ No color, typography, padding, margin, or grid changes to unrelated components
- ✅ No changes to hero, categories, or product cards
- ✅ No component renaming or file moves
- ✅ No payment, cart, or product logic touched
- ✅ Footer BSM section uses same typography and spacing as "Sellers" column

## Files Added (11)
- `components/layout/ProfileIconClient.tsx`
- `app/help/page.tsx`
- `app/terms/page.tsx`
- `app/contact/page.tsx`
- `app/seller/apply/page.tsx`
- `app/seller/resources/page.tsx`
- `app/bsm/apply/page.tsx`
- `app/bsm/resources/page.tsx`
- `CHANGELOG-AUTH-BSM-FIXES.md`

## Files Modified (5)
- `lib/auth/routeByRole.ts` - Added BSM role, fixed seller routing
- `components/auth/AuthCard.tsx` - Added BSM helper text
- `components/layout/Header.tsx` - Replaced profile Link with ProfileIconClient
- `components/layout/LanguageCurrencyMenu.tsx` - Added persistence & refresh
- `lib/currency.ts` - Added formatMoney utility
- `app/layout-content.tsx` - Added BSM footer section, fixed seller links

## Test Results
All routes tested and returning 200 OK:
```
✅ /auth - 200
✅ /notifications - 200
✅ /help - 200
✅ /privacy - 200
✅ /terms - 200
✅ /contact - 200
✅ /seller/apply - 200
✅ /seller/resources - 200
✅ /bsm/apply - 200
✅ /bsm/resources - 200
✅ /dashboard/bsm - 200
```

## Technical Implementation Details

### Role-Based Routing
```typescript
// lib/auth/routeByRole.ts
case "buyer": return "/dashboard/buyer";
case "seller": return "/dashboard/vendor";
case "bsm": return "/dashboard/bsm";
```

### Currency Formatter
```typescript
// lib/currency.ts
export function formatMoney(amount: number, currency = 'USD', locale = 'en-US') {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}
```

### Language Persistence
```typescript
// components/layout/LanguageCurrencyMenu.tsx
const handleLanguageChange = (code: string) => {
  setLanguage(code);
  localStorage.setItem("preferred_language", code);
  document.cookie = `locale=${code}; path=/; max-age=31536000`;
  router.refresh();
};
```

---

**Status**: ✅ All acceptance criteria met. No 404s. No unrelated changes.
