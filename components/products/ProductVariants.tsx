'use client';

import { useMemo, useState } from 'react';
import { useBrand } from '@/components/BrandProvider';

type Variant = {
  title: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  price: number;
  inventory_quantity: number;
  sku: string;
  weight_grams: number;
  is_active: boolean;
};

interface ProductVariantsProps {
  formData: {
    base_price: number;
    weight_grams?: number;
    variants: Variant[];
  };
  updateFormData: (updates: Partial<{ variants: Variant[] }>) => void;
}

export default function ProductVariants({ formData, updateFormData }: ProductVariantsProps) {
  const { brand, theme } = useBrand();
  const [showAddVariant, setShowAddVariant] = useState(false);

  const baseWeight = useMemo(() => Math.max(0, Number(formData?.weight_grams ?? 0)), [formData?.weight_grams]);

  const addVariant = () => {
    const next: Variant = {
      title: `Variant ${formData.variants.length + 1}`,
      option1: null,
      option2: null,
      option3: null,
      price: Number(formData.base_price ?? 0) || 0,
      inventory_quantity: 0,
      sku: '',
      weight_grams: baseWeight,
      is_active: true,
    };
    updateFormData({ variants: [...formData.variants, next] });
    setShowAddVariant(false);
  };

  const updateVariant = (index: number, updates: Partial<Variant>) => {
    const updated = formData.variants.map((v, i) => (i === index ? { ...v, ...updates } : v));
    updateFormData({ variants: updated });
  };

  const removeVariant = (index: number) => {
    if (formData.variants.length <= 1) return;
    const updated = formData.variants.filter((_, i) => i !== index);
    updateFormData({ variants: updated });
  };

  const duplicateVariant = (index: number) => {
    const src = formData.variants[index];
    const clone: Variant = {
      ...src,
      title: `${src.title} (Copy)`,
      sku: '', // force new SKU
    };
    const updated = [...formData.variants.slice(0, index + 1), clone, ...formData.variants.slice(index + 1)];
    updateFormData({ variants: updated });
  };

  const autoSku = (v: Variant) => {
    const parts = [
      (v.title || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 18),
      v.option1 ? String(v.option1).toUpperCase() : '',
      v.option2 ? String(v.option2).toUpperCase() : '',
      v.option3 ? String(v.option3).toUpperCase() : '',
    ]
      .filter(Boolean)
      .join('-')
      .replace(/-+/g, '-');
    return parts || 'SKU';
  };

  // helpers
  const toNumber = (val: string, fallback = 0) => {
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
  };
  const toInt = (val: string, fallback = 0) => {
    const n = parseInt(val, 10);
    return Number.isFinite(n) ? n : fallback;
    };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
          {brand === 'primediscreet' ? 'Elite Product Variants' : 'Product Variants'}
        </h2>
        <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
          {brand === 'primediscreet'
            ? 'Create exclusive variations of your elite product (sizes, colors, materials).'
            : 'Create different variations of your product (sizes, colors, materials, etc.).'}
        </p>
      </div>

      {/* Variants List */}
      <div className="space-y-4">
        {formData.variants.map((variant, index) => (
          <div
            key={index}
            className="p-6 border rounded-lg"
            style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.glass.border }}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="font-medium" style={{ color: theme.colors.text.primary }}>
                Variant {index + 1}
              </h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => duplicateVariant(index)}
                  className="text-sm underline hover:opacity-80"
                  style={{ color: theme.colors.text.secondary }}
                >
                  Duplicate
                </button>
                {formData.variants.length > 1 && (
                  <button onClick={() => removeVariant(index)} className="text-red-500 hover:text-red-700 text-sm">
                    Remove
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Variant Title */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Variant Title
                </label>
                <input
                  type="text"
                  value={variant.title}
                  onChange={(e) => updateVariant(index, { title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary,
                  }}
                  placeholder="e.g., Small Red, Large Blue"
                />
              </div>

              {/* Option 1 (e.g., Size) */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Size / Option 1
                </label>
                <input
                  type="text"
                  value={variant.option1 || ''}
                  onChange={(e) => updateVariant(index, { option1: e.target.value || null })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary,
                  }}
                  placeholder="e.g., Small, Medium, Large"
                />
              </div>

              {/* Option 2 (e.g., Color) */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Color / Option 2
                </label>
                <input
                  type="text"
                  value={variant.option2 || ''}
                  onChange={(e) => updateVariant(index, { option2: e.target.value || null })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary,
                  }}
                  placeholder="e.g., Red, Blue, Black"
                />
              </div>

              {/* Option 3 (e.g., Material/Pattern) */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Option 3 (optional)
                </label>
                <input
                  type="text"
                  value={variant.option3 || ''}
                  onChange={(e) => updateVariant(index, { option3: e.target.value || null })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary,
                  }}
                  placeholder="e.g., Material / Pattern"
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Price (base currency)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={variant.price}
                  onChange={(e) => updateVariant(index, { price: Math.max(0, toNumber(e.target.value, 0)) })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary,
                  }}
                  placeholder="0.00"
                />
              </div>

              {/* Inventory */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Inventory Quantity
                </label>
                <input
                  type="number"
                  min={0}
                  value={variant.inventory_quantity}
                  onChange={(e) =>
                    updateVariant(index, { inventory_quantity: Math.max(0, toInt(e.target.value, 0)) })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary,
                  }}
                  placeholder="0"
                />
              </div>

              {/* SKU */}
              <div className="flex flex-col">
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  SKU (optional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={variant.sku}
                    onChange={(e) => updateVariant(index, { sku: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: theme.colors.background,
                      borderColor: theme.colors.glass.border,
                      color: theme.colors.text.primary,
                    }}
                    placeholder="e.g., PROD-SM-RED"
                  />
                  <button
                    type="button"
                    onClick={() => updateVariant(index, { sku: autoSku(variant) })}
                    className="px-3 rounded-lg border text-sm"
                    style={{ borderColor: theme.colors.glass.border, color: theme.colors.text.secondary }}
                    title="Generate SKU from title/options"
                  >
                    Auto
                  </button>
                </div>
              </div>

              {/* Weight */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Weight (grams)
                </label>
                <input
                  type="number"
                  min={0}
                  value={variant.weight_grams}
                  onChange={(e) => updateVariant(index, { weight_grams: Math.max(0, toInt(e.target.value, 0)) })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary,
                  }}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Variant Settings */}
            <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: theme.colors.glass.border }}>
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={variant.is_active}
                  onChange={(e) => updateVariant(index, { is_active: e.target.checked })}
                  className="rounded"
                />
                <span style={{ color: theme.colors.text.primary }}>Active</span>
              </label>
              <div className="text-xs" style={{ color: theme.colors.text.secondary }}>
                Tip: Use clear titles (e.g., “Small / Red / Silk”) to help buyers pick quickly.
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Variant Button */}
      <div className="text-center">
        <button
          onClick={addVariant}
          className="px-6 py-3 border-2 border-dashed rounded-lg font-medium transition-all hover:border-solid"
          style={{ borderColor: theme.colors.glass.border, color: theme.colors.text.secondary }}
        >
          + Add Variant
        </button>
      </div>

      {/* Variant Options Help */}
      <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.background }}>
        <h4 className="font-medium mb-2" style={{ color: theme.colors.text.primary }}>
          Variant Options Guide
        </h4>
        <div className="text-sm space-y-1" style={{ color: theme.colors.text.secondary }}>
          <p><strong>Option 1:</strong> Usually size (XS, S, M, L, XL)</p>
          <p><strong>Option 2:</strong> Usually color (Red, Blue, Black)</p>
          <p><strong>Option 3:</strong> Additional attribute (Material, Pattern, etc.)</p>
          <p><strong>SKU:</strong> Unique identifier for inventory tracking</p>
        </div>
      </div>
    </div>
  );
}
