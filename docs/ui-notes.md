# EntizNetStore UI Architecture - Royal Desire (Option A)

## Royal Desire Color Palette

### Palette Variables & Tailwind Tokens

The Royal Desire (Option A) palette is defined in `app/globals.css`:

```css
:root {
  /* Royal Desire (Option A) — Purple + Gold Luxury */
  --brand-primary: #7A00D1;   /* Royal Purple */
  --brand-secondary: #D1B000; /* Luxury Gold */
  --background: #0B0A0D;      /* Velvet Black */
  --foreground: #F4F3F6;      /* Off-white text */
  --muted: #1A1720;
  --card: #121017;
  --border: rgba(255,255,255,0.12);
}
```

### Tailwind Configuration

Colors are mapped in `tailwind.config.ts`:

```typescript
colors: {
  brand: {
    primary: "var(--brand-primary, #7A00D1)",     // Royal Purple
    secondary: "var(--brand-secondary, #D1B000)", // Luxury Gold
  },
  background: "var(--background, #0B0A0D)",
  foreground: "var(--foreground, #F4F3F6)",
  border: "var(--border, rgba(255,255,255,0.12))",
  muted: "var(--muted, #1A1720)",
  card: "var(--card, #121017)",
}
```

### Usage

- Primary actions and accents: `text-brand-primary` or `bg-brand-primary`
- Gold highlights and CTAs: `text-brand-secondary` or `bg-brand-secondary`
- Backgrounds: `bg-background` or `bg-card`
- Text: `text-foreground`
- Borders: `border-border`

## Two-Level Navigation

### TopBar
Located in `components/layout/Header.tsx`:
- **Logo**: EntizNetStore branding
- **Links**: Stores, Brands, Live, On Sale, Learn
- **Search**: Compact search bar (max-w-[520px] on desktop)
- **Language+Currency**: Single dropdown component
- **Icons**: Sign in, Profile, Cart, Notifications

### MainNav
Category tabs below TopBar:
- Home, Premium, Luxury, Collections, Smart Devices, Gift Sets
- Full-width navigation bar with hover effects

## Full-Width Layout

The site is configured for edge-to-edge layout:

- **Body**: `w-full overflow-x-hidden` in `app/layout.tsx`
- **Main**: `w-full` wrapper for all content
- **Hero**: No rounded corners, full-width at 70vh height
- **Sections**: Use `w-full` with `px-4 md:px-6` for breathing room

NO `max-w-*` or `container` classes are used on main layout components.

## Categories Section

Located in `components/home/CategoriesRow.tsx`:

### Grid Configuration
- **Desktop**: `grid-cols-8` → Creates 2 rows of 8 items (16 total)
- **Tablet**: `grid-cols-6`
- **Mobile**: `grid-cols-4`

### Adding Categories
Edit the `CATEGORIES` array:

```typescript
const CATEGORIES = [
  { name: "Category Name", icon: <IconComponent className="h-7 w-7" />, href: "/categories/slug" },
  // ... exactly 16 items
];
```

Icons from `lucide-react` are recommended. Keep exactly 16 items for the 2-row layout.

### Effects
- Hover: `scale-105` transform (fast, 150ms)
- Border: Changes to `brand-secondary/50` on hover
- Text: Changes to `brand-secondary` on hover

## Featured Sections

Located in `components/home/FeaturedSection.tsx` - a reusable component.

### Order (9 sections)
1. Best Selling Products
2. Top Sellers
3. Top Sellers in Dildos for you
4. Top categories in Vibrator
5. International top sellers in Dolls
6. Best Sellers in Beauty & Personal Care
7. Popular products in Essentials internationally
8. Local top sellers
9. International top sellers

### Adding Featured Sections

In `app/page.tsx`:

```typescript
<FeaturedSection
  title="Section Title"
  items={productArray}
  viewAllHref="/link-to-view-all"
/>
```

Each item needs: `id`, `title`, `price`, `rating` (optional), `href`, `image` (optional)

## Language & Currency Persistence

Located in `components/layout/LanguageCurrencyMenu.tsx`:

### Storage
Uses `localStorage` for persistence:
- Language: `preferred_language` (e.g., "en", "es", "fr")
- Currency: `preferred_currency` (e.g., "USD", "EUR", "GBP")

### Adding Languages/Currencies

Edit the arrays in `LanguageCurrencyMenu.tsx`:

```typescript
const LANGUAGES = [
  { code: "en", label: "English" },
  // Add more
];

const CURRENCIES = [
  { code: "USD", symbol: "$", label: "US Dollar" },
  // Add more
];
```

The dropdown automatically saves selections and restores them on page load.

## Route Structure

New routes created for MainNav:
- `/premium` - Premium products page
- `/luxury` - Luxury collection page
- `/collections` - Curated collections
- `/smart-devices` - Smart toys and tech
- `/gift-sets` - Gift bundles

All routes return simple placeholder pages that can be expanded with full product grids.

## Performance Notes

- Transitions: `duration-150 ease-out` for fast, smooth effects
- No heavy shadows or filters
- Images use proper `sizes` prop for responsive optimization
- Categories use minimal hover effects for performance

## Security (CSP)

Google Fonts are allowed in `middleware.ts`:
- `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
- `font-src 'self' data: https: https://fonts.gstatic.com`

This ensures Cormorant Garamond (serif) and Inter (sans) load correctly.
