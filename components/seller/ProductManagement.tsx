'use client'

import { useBrand } from '@/components/BrandProvider'
import Link from 'next/link'

interface ProductManagementProps {
  products: any[]
}

export default function ProductManagement({ products }: ProductManagementProps) {
  const { brand, theme } = useBrand()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
          {brand === 'primediscreet' ? 'Elite Product Collection' : 'Product Management'}
        </h2>
        <Link
          href="/seller/products/new"
          className="px-4 py-2 rounded-lg font-medium transition-all"
          style={{
            backgroundColor: theme.colors.accent,
            color: brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary
          }}
        >
          {brand === 'primediscreet' ? 'Add Exclusive Item' : 'Add Product'}
        </Link>
      </div>

      {products.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="p-6 rounded-lg border transition-all hover:shadow-lg"
              style={{ 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.glass.border 
              }}
            >
              {/* Product Image */}
              <div className="aspect-square bg-gray-100 rounded-lg mb-4 overflow-hidden">
                {product.product_media?.[0]?.url ? (
                  <img 
                    src={product.product_media[0].url} 
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    No Image
                  </div>
                )}
              </div>

              {/* Product Details */}
              <h3 className="font-semibold mb-2 line-clamp-2" style={{ color: theme.colors.text.primary }}>
                {product.title}
              </h3>
              
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg font-bold" style={{ color: theme.colors.accent }}>
                  ${product.base_price}
                </span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  product.status === 'active' ? 'bg-green-100 text-green-800' :
                  product.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {product.status}
                </span>
              </div>

              <div className="text-sm mb-4" style={{ color: theme.colors.text.secondary }}>
                Brand: {product.marketplace_brand === 'primediscreet' ? 'Prime Discreet' : 'EntizNet Store'}
              </div>

              {/* Stock Info */}
              {product.product_variants?.length > 0 && (
                <div className="text-sm mb-4" style={{ color: theme.colors.text.secondary }}>
                  Stock: {product.product_variants.reduce((total: number, variant: any) => 
                    total + (variant.inventory_quantity || 0), 0)} units
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Link
                  href={`/seller/products/${product.id}/edit`}
                  className="flex-1 px-3 py-2 text-center rounded border font-medium text-sm transition-all"
                  style={{
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                >
                  Edit
                </Link>
                <Link
                  href={`/store/${product.slug || product.id}`}
                  className="flex-1 px-3 py-2 text-center rounded font-medium text-sm transition-all"
                  style={{
                    backgroundColor: theme.colors.accent,
                    color: brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary
                  }}
                >
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-6xl mb-4" style={{ color: theme.colors.accent }}>📦</div>
          <h3 className="text-xl font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
            No Products Yet
          </h3>
          <p className="mb-6" style={{ color: theme.colors.text.secondary }}>
            {brand === 'primediscreet' 
              ? 'Start building your exclusive elite collection'
              : 'Create your first product to start selling'
            }
          </p>
          <Link
            href="/seller/products/new"
            className="px-6 py-3 rounded-lg font-medium"
            style={{
              backgroundColor: theme.colors.accent,
              color: brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary
            }}
          >
            {brand === 'primediscreet' ? 'Add Exclusive Product' : 'Create First Product'}
          </Link>
        </div>
      )}
    </div>
  )
}