'use client'

import { useBrand } from '@/components/BrandProvider'

export default function BrandSwitcher() {
  const { brand, setBrand, theme } = useBrand()

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium" style={{ color: theme.colors.text.secondary }}>
        Brand:
      </span>
      <select
        value={brand}
        onChange={(e) => setBrand(e.target.value as 'entiznetstore' | 'primediscreet')}
        className="px-3 py-1 rounded border text-sm font-medium transition-all"
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.glass.border,
          color: theme.colors.text.primary
        }}
      >
        <option value="entiznetstore">EntizNet Store</option>
        <option value="primediscreet">Prime Discreet</option>
      </select>
    </div>
  )
}