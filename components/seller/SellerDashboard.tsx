'use client'

import { useState } from 'react'
import { useBrand } from '@/components/BrandProvider'
import Link from 'next/link'
import SellerAnalytics from './SellerAnalytics'
import BrandSwitcher from './BrandSwitcher'
import ProductManagement from './ProductManagement'
import OrderManagement from './OrderManagement'
import EarningsOverview from './EarningsOverview'

interface SellerDashboardProps {
  sellerProfile: any
  products: any[]
  orders: any[]
  reviews: any[]
}

export default function SellerDashboard({ 
  sellerProfile, 
  products, 
  orders, 
  reviews 
}: SellerDashboardProps) {
  const { brand, config, theme } = useBrand()
  const [activeTab, setActiveTab] = useState('overview')

  // Calculate analytics
  const totalProducts = products.length
  const activeProducts = products.filter(p => p.status === 'active').length
  const totalRevenue = orders.reduce((sum, order) => sum + (order.total_cents / 100), 0)
  const avgRating = reviews.length > 0 
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
    : 0

  // Brand-specific data
  const brandProducts = products.filter(p => p.marketplace_brand === brand)
  const brandOrders = orders.filter(order => 
    order.order_items?.some((item: any) => 
      products.find(p => p.title === item.product_title)?.marketplace_brand === brand
    )
  )

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'products', label: 'Products', icon: '📦' },
    { id: 'orders', label: 'Orders', icon: '🛒' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'earnings', label: 'Earnings', icon: '💰' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.colors.background }}>
      {/* Dashboard Header */}
      <div className="border-b" style={{ borderColor: theme.colors.glass.border }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold" style={{ color: theme.colors.text.primary }}>
                {brand === 'primediscreet' ? 'Elite Seller Portal' : 'Seller Dashboard'}
              </h1>
              <p className="mt-1" style={{ color: theme.colors.text.secondary }}>
                Welcome back, {sellerProfile.storefront_name}
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <BrandSwitcher />
              <Link
                href="/seller/products/new"
                className="px-4 py-2 rounded-lg font-medium transition-all"
                style={{
                  backgroundColor: theme.colors.accent,
                  color: brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary
                }}
              >
                {brand === 'primediscreet' ? 'Add Exclusive Product' : 'Add Product'}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Brand-Specific Stats Overview */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="p-6 rounded-lg" style={{ 
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.glass.border 
          }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: theme.colors.text.secondary }}>
                  {brand === 'primediscreet' ? 'Elite Products' : 'Active Products'}
                </p>
                <p className="text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
                  {brandProducts.filter(p => p.status === 'active').length}
                </p>
              </div>
              <div className="text-2xl" style={{ color: theme.colors.accent }}>📦</div>
            </div>
          </div>

          <div className="p-6 rounded-lg" style={{ 
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.glass.border 
          }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: theme.colors.text.secondary }}>
                  {brand === 'primediscreet' ? 'Elite Revenue' : 'Total Revenue'}
                </p>
                <p className="text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
                  ${totalRevenue.toFixed(2)}
                </p>
              </div>
              <div className="text-2xl" style={{ color: theme.colors.accent }}>💰</div>
            </div>
          </div>

          <div className="p-6 rounded-lg" style={{ 
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.glass.border 
          }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: theme.colors.text.secondary }}>
                  Average Rating
                </p>
                <p className="text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
                  {avgRating > 0 ? avgRating.toFixed(1) : 'N/A'}
                  {avgRating > 0 && <span className="text-sm ml-1">⭐</span>}
                </p>
              </div>
              <div className="text-2xl" style={{ color: theme.colors.accent }}>⭐</div>
            </div>
          </div>

          <div className="p-6 rounded-lg" style={{ 
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.glass.border 
          }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: theme.colors.text.secondary }}>
                  {brand === 'primediscreet' ? 'Elite Orders' : 'Total Orders'}
                </p>
                <p className="text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
                  {brandOrders.length}
                </p>
              </div>
              <div className="text-2xl" style={{ color: theme.colors.accent }}>🛒</div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b mb-8" style={{ borderColor: theme.colors.glass.border }}>
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-current'
                    : 'border-transparent hover:border-gray-300'
                }`}
                style={{
                  color: activeTab === tab.id ? theme.colors.accent : theme.colors.text.secondary
                }}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Link
                  href="/seller/products/new"
                  className="p-6 rounded-lg border-2 border-dashed transition-all hover:border-solid"
                  style={{ 
                    borderColor: theme.colors.glass.border,
                    backgroundColor: theme.colors.surface 
                  }}
                >
                  <div className="text-center">
                    <div className="text-3xl mb-2" style={{ color: theme.colors.accent }}>➕</div>
                    <h3 className="font-medium" style={{ color: theme.colors.text.primary }}>
                      {brand === 'primediscreet' ? 'Add Elite Product' : 'Add New Product'}
                    </h3>
                    <p className="text-sm mt-1" style={{ color: theme.colors.text.secondary }}>
                      {brand === 'primediscreet' 
                        ? 'Expand your exclusive collection' 
                        : 'Grow your product catalog'
                      }
                    </p>
                  </div>
                </Link>

                <Link
                  href="/seller/orders"
                  className="p-6 rounded-lg border transition-all hover:shadow-lg"
                  style={{ 
                    borderColor: theme.colors.glass.border,
                    backgroundColor: theme.colors.surface 
                  }}
                >
                  <div className="text-center">
                    <div className="text-3xl mb-2" style={{ color: theme.colors.accent }}>📋</div>
                    <h3 className="font-medium" style={{ color: theme.colors.text.primary }}>
                      Manage Orders
                    </h3>
                    <p className="text-sm mt-1" style={{ color: theme.colors.text.secondary }}>
                      {orders.filter(o => o.status === 'pending').length} pending orders
                    </p>
                  </div>
                </Link>

                <Link
                  href="/seller/analytics"
                  className="p-6 rounded-lg border transition-all hover:shadow-lg"
                  style={{ 
                    borderColor: theme.colors.glass.border,
                    backgroundColor: theme.colors.surface 
                  }}
                >
                  <div className="text-center">
                    <div className="text-3xl mb-2" style={{ color: theme.colors.accent }}>📊</div>
                    <h3 className="font-medium" style={{ color: theme.colors.text.primary }}>
                      View Analytics
                    </h3>
                    <p className="text-sm mt-1" style={{ color: theme.colors.text.secondary }}>
                      Track your performance
                    </p>
                  </div>
                </Link>
              </div>

              {/* Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Orders */}
                <div className="p-6 rounded-lg" style={{ 
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.glass.border 
                }}>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: theme.colors.text.primary }}>
                    Recent Orders
                  </h3>
                  <div className="space-y-3">
                    {orders.slice(0, 5).map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-3 rounded border" 
                           style={{ borderColor: theme.colors.glass.border }}>
                        <div>
                          <p className="font-medium" style={{ color: theme.colors.text.primary }}>
                            #{order.order_number}
                          </p>
                          <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
                            {new Date(order.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium" style={{ color: theme.colors.accent }}>
                            ${(order.total_cents / 100).toFixed(2)}
                          </p>
                          <span className={`text-xs px-2 py-1 rounded ${
                            order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                            order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Reviews */}
                <div className="p-6 rounded-lg" style={{ 
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.glass.border 
                }}>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: theme.colors.text.primary }}>
                    Recent Reviews
                  </h3>
                  <div className="space-y-3">
                    {reviews.slice(0, 5).map((review) => (
                      <div key={review.id} className="p-3 rounded border" 
                           style={{ borderColor: theme.colors.glass.border }}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center">
                            <div className="flex text-yellow-400 mr-2">
                              {Array.from({ length: 5 }, (_, i) => (
                                <span key={i} className={i < review.rating ? 'text-yellow-400' : 'text-gray-300'}>
                                  ⭐
                                </span>
                              ))}
                            </div>
                            <span className="text-sm" style={{ color: theme.colors.text.secondary }}>
                              {new Date(review.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm" style={{ color: theme.colors.text.primary }}>
                          {review.title || review.content?.slice(0, 100) + '...'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <ProductManagement products={brandProducts} />
          )}

          {activeTab === 'orders' && (
            <OrderManagement orders={brandOrders} />
          )}

          {activeTab === 'analytics' && (
            <SellerAnalytics 
              products={brandProducts} 
              orders={brandOrders} 
              reviews={reviews} 
            />
          )}

          {activeTab === 'earnings' && (
            <EarningsOverview orders={brandOrders} />
          )}

          {activeTab === 'settings' && (
            <div className="p-6 rounded-lg" style={{ 
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.glass.border 
            }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: theme.colors.text.primary }}>
                Seller Settings
              </h3>
              <p style={{ color: theme.colors.text.secondary }}>
                Settings panel coming soon...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}