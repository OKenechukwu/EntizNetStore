'use client'

import { useState, useEffect } from 'react'
import { useBrand } from '@/components/BrandProvider'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import CategoryManager from './CategoryManager'
import FeaturedProductsManager from './FeaturedProductsManager'

interface DashboardStats {
  totalRevenue: number
  totalOrders: number
  totalUsers: number
  totalProducts: number
  pendingOrders: number
  activeUsers: number
  conversionRate: number
  avgOrderValue: number
}

interface RecentActivity {
  id: string
  type: 'order' | 'user' | 'product' | 'review'
  description: string
  timestamp: string
  status?: string
}

export default function AdminDashboard() {
  const { theme, brand } = useBrand()
  const [activeTab, setActiveTab] = useState('overview')
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalOrders: 0,
    totalUsers: 0,
    totalProducts: 0,
    pendingOrders: 0,
    activeUsers: 0,
    conversionRate: 0,
    avgOrderValue: 0
  })
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [timeFilter, setTimeFilter] = useState('7d')
  const supabase = createClientComponentClient()

  useEffect(() => {
    loadDashboardData()
  }, [timeFilter])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      // Load stats
      const [statsResponse, activityResponse] = await Promise.all([
        fetch(`/api/admin/stats?period=${timeFilter}&brand=${brand}`),
        fetch(`/api/admin/activity?brand=${brand}`)
      ])

      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData)
      }

      if (activityResponse.ok) {
        const activityData = await activityResponse.json()
        setRecentActivity(activityData.activities || [])
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => `$${amount.toLocaleString()}`
  const formatPercentage = (value: number) => `${value.toFixed(1)}%`

  const StatCard = ({ title, value, change, icon, trend }: {
    title: string
    value: string | number
    change?: string
    icon: string
    trend?: 'up' | 'down' | 'neutral'
  }) => (
    <div className="p-6 border rounded-lg"
         style={{ 
           backgroundColor: theme.colors.surface,
           borderColor: theme.colors.glass.border 
         }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium" style={{ color: theme.colors.text.secondary }}>
            {title}
          </p>
          <p className="text-2xl font-bold mt-1" style={{ color: theme.colors.text.primary }}>
            {value}
          </p>
          {change && (
            <p className={`text-sm mt-1 flex items-center gap-1 ${
              trend === 'up' ? 'text-green-600' : 
              trend === 'down' ? 'text-red-600' : 
              'text-gray-600'
            }`}>
              {trend === 'up' ? '↗️' : trend === 'down' ? '↘️' : '↔️'}
              {change}
            </p>
          )}
        </div>
        <div className="text-3xl">{icon}</div>
      </div>
    </div>
  )

  const ActivityItem = ({ activity }: { activity: RecentActivity }) => (
    <div className="flex items-center gap-3 p-3 border rounded-lg"
         style={{ borderColor: theme.colors.glass.border }}>
      <div className="text-2xl">
        {activity.type === 'order' ? '🛒' :
         activity.type === 'user' ? '👤' :
         activity.type === 'product' ? '📦' : 
         '⭐'}
      </div>
      <div className="flex-1">
        <p className="font-medium" style={{ color: theme.colors.text.primary }}>
          {activity.description}
        </p>
        <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
          {new Date(activity.timestamp).toLocaleString()}
        </p>
      </div>
      {activity.status && (
        <span className={`px-2 py-1 text-xs rounded-full ${
          activity.status === 'completed' ? 'bg-green-100 text-green-800' :
          activity.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
          'bg-red-100 text-red-800'
        }`}>
          {activity.status}
        </span>
      )}
    </div>
  )

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'orders', label: 'Orders', icon: '🛒' },
    { id: 'products', label: 'Products', icon: '📦' },
    { id: 'categories', label: 'Categories', icon: '🗂️' },
    { id: 'featured', label: 'Featured', icon: '⭐' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
  ]

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: theme.colors.background }}>
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-64 rounded" style={{ backgroundColor: theme.colors.surface }}></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(8)].map((_, index) => (
                <div key={index} className="h-32 rounded-lg" style={{ backgroundColor: theme.colors.surface }}></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.colors.background }}>
      <div className="container mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: theme.colors.text.primary }}>
              {brand === 'primediscreet' ? 'Elite Admin Dashboard' : 'Admin Dashboard'}
            </h1>
            <p style={{ color: theme.colors.text.secondary }}>
              Marketplace management and analytics
            </p>
          </div>

          {/* Time Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: theme.colors.text.secondary }}>Period:</span>
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="px-3 py-1 border rounded-lg text-sm"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.glass.border,
                color: theme.colors.text.primary
              }}
            >
              <option value="1d">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 mb-8 border-b"
             style={{ borderColor: theme.colors.glass.border }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                activeTab === tab.id 
                  ? 'border-b-2' 
                  : 'hover:bg-opacity-80'
              }`}
              style={{
                borderBottomColor: activeTab === tab.id ? theme.colors.accent : 'transparent',
                color: activeTab === tab.id ? theme.colors.accent : theme.colors.text.secondary
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Total Revenue"
                value={formatCurrency(stats.totalRevenue)}
                change="+12.5% from last period"
                icon="💰"
                trend="up"
              />
              <StatCard
                title="Total Orders"
                value={stats.totalOrders.toLocaleString()}
                change="+8.3% from last period"
                icon="🛒"
                trend="up"
              />
              <StatCard
                title="Active Users"
                value={stats.activeUsers.toLocaleString()}
                change="+15.2% from last period"
                icon="👥"
                trend="up"
              />
              <StatCard
                title="Conversion Rate"
                value={formatPercentage(stats.conversionRate)}
                change="-0.5% from last period"
                icon="📊"
                trend="down"
              />
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Total Products"
                value={stats.totalProducts.toLocaleString()}
                icon="📦"
              />
              <StatCard
                title="Pending Orders"
                value={stats.pendingOrders.toLocaleString()}
                icon="⏳"
              />
              <StatCard
                title="Avg Order Value"
                value={formatCurrency(stats.avgOrderValue)}
                change="+5.8% from last period"
                icon="💳"
                trend="up"
              />
              <StatCard
                title="Total Users"
                value={stats.totalUsers.toLocaleString()}
                icon="🌟"
              />
            </div>

            {/* Recent Activity & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Recent Activity */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold" style={{ color: theme.colors.text.primary }}>
                  Recent Activity
                </h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {recentActivity.map(activity => (
                    <ActivityItem key={activity.id} activity={activity} />
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold" style={{ color: theme.colors.text.primary }}>
                  Quick Actions
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Add Product', icon: '➕', action: 'add-product' },
                    { label: 'Process Orders', icon: '📋', action: 'orders' },
                    { label: 'User Management', icon: '👤', action: 'users' },
                    { label: 'View Analytics', icon: '📊', action: 'analytics' },
                    { label: 'Moderate Reviews', icon: '⭐', action: 'reviews' },
                    { label: 'System Settings', icon: '⚙️', action: 'settings' }
                  ].map(action => (
                    <button
                      key={action.action}
                      onClick={() => setActiveTab(action.action === 'add-product' ? 'products' : action.action)}
                      className="p-4 border rounded-lg hover:shadow-md transition-all text-center"
                      style={{
                        borderColor: theme.colors.glass.border,
                        backgroundColor: theme.colors.surface
                      }}
                    >
                      <div className="text-2xl mb-2">{action.icon}</div>
                      <div className="text-sm font-medium" style={{ color: theme.colors.text.primary }}>
                        {action.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Performance Chart Placeholder */}
            <div className="border rounded-lg p-6"
                 style={{ 
                   backgroundColor: theme.colors.surface,
                   borderColor: theme.colors.glass.border 
                 }}>
              <h3 className="text-xl font-semibold mb-4" style={{ color: theme.colors.text.primary }}>
                Revenue Trend
              </h3>
              <div className="h-64 flex items-center justify-center"
                   style={{ backgroundColor: theme.colors.background }}>
                <div className="text-center space-y-2">
                  <div className="text-4xl">📈</div>
                  <p style={{ color: theme.colors.text.secondary }}>
                    Revenue chart would be displayed here
                  </p>
                  <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
                    Integration with charting library coming soon
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold" style={{ color: theme.colors.text.primary }}>
                Order Management
              </h2>
              <div className="flex items-center gap-3">
                <select className="px-3 py-2 border rounded-lg"
                        style={{
                          backgroundColor: theme.colors.surface,
                          borderColor: theme.colors.glass.border,
                          color: theme.colors.text.primary
                        }}>
                  <option>All Orders</option>
                  <option>Pending</option>
                  <option>Processing</option>
                  <option>Shipped</option>
                  <option>Delivered</option>
                </select>
              </div>
            </div>
            
            <div className="border rounded-lg p-6 text-center"
                 style={{ 
                   backgroundColor: theme.colors.surface,
                   borderColor: theme.colors.glass.border 
                 }}>
              <div className="text-4xl mb-4">🛒</div>
              <h3 className="text-xl font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
                Order Management Interface
              </h3>
              <p style={{ color: theme.colors.text.secondary }}>
                Comprehensive order tracking and management system coming soon
              </p>
            </div>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold" style={{ color: theme.colors.text.primary }}>
                Product Management
              </h2>
              <button
                className="px-4 py-2 rounded-lg font-medium"
                style={{
                  backgroundColor: theme.colors.accent,
                  color: brand === 'primediscreet' ? theme.colors.background : 'white'
                }}
              >
                Add New Product
              </button>
            </div>
            
            <div className="border rounded-lg p-6 text-center"
                 style={{ 
                   backgroundColor: theme.colors.surface,
                   borderColor: theme.colors.glass.border 
                 }}>
              <div className="text-4xl mb-4">📦</div>
              <h3 className="text-xl font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
                Product Management Interface
              </h3>
              <p style={{ color: theme.colors.text.secondary }}>
                Product listing, editing, and inventory management coming soon
              </p>
            </div>
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && <CategoryManager />}

        {/* Featured Products Tab */}
        {activeTab === 'featured' && <FeaturedProductsManager />}

        {/* Other tabs placeholder */}
        {['users', 'analytics', 'settings'].includes(activeTab) && (
          <div className="border rounded-lg p-6 text-center"
               style={{ 
                 backgroundColor: theme.colors.surface,
                 borderColor: theme.colors.glass.border 
               }}>
            <div className="text-4xl mb-4">
              {activeTab === 'users' ? '👥' : 
               activeTab === 'analytics' ? '📈' : '⚙️'}
            </div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
              {activeTab === 'users' ? 'User Management' : 
               activeTab === 'analytics' ? 'Advanced Analytics' : 'System Settings'}
            </h3>
            <p style={{ color: theme.colors.text.secondary }}>
              {activeTab === 'users' ? 'User management and verification system' : 
               activeTab === 'analytics' ? 'Detailed analytics and reporting dashboard' : 'System configuration and settings'} coming soon
            </p>
          </div>
        )}
      </div>
    </div>
  )
}