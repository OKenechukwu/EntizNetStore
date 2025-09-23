"use client";

import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/sign-in')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="opacity-80">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect
  }

  const userName = user.role === 'seller' 
    ? (user.profile as any)?.storefront_name || user.email.split('@')[0]
    : (user.profile as any)?.display_name || user.email.split('@')[0]

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="glass-card p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-accent-gold mb-2">
              Welcome back, {userName}
            </h1>
            <p className="opacity-80">
              {user.role === 'seller' ? 'Manage your store and products' : 'Manage your account and orders'}
            </p>
          </div>
          <div className="text-sm px-3 py-1 rounded-full bg-accent-gold/20 text-accent-gold font-medium capitalize">
            {user.role}
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      {user.role === 'seller' ? (
        <SellerDashboard />
      ) : (
        <BuyerDashboard />
      )}
    </div>
  )
}

function SellerDashboard() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Quick Actions */}
      <div className="lg:col-span-2 space-y-6">
        <div className="glass-card p-6">
          <h2 className="font-serif text-xl font-bold text-accent-gold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-4">
            <Link 
              href="/dashboard/products/add"
              className="luxury-button text-center py-4"
            >
              Add Product
            </Link>
            <Link 
              href="/dashboard/products"
              className="luxury-button-outline text-center py-4"
            >
              Manage Products
            </Link>
            <Link 
              href="/dashboard/orders"
              className="luxury-button-outline text-center py-4"
            >
              View Orders
            </Link>
            <Link 
              href="/dashboard/analytics"
              className="luxury-button-outline text-center py-4"
            >
              Analytics
            </Link>
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="font-serif text-xl font-bold text-accent-gold mb-4">Store Status</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-charcoal/20">
              <span>Verification Status</span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-600/20 text-yellow-400">
                Pending
              </span>
            </div>
            <Link 
              href="/dashboard/verification"
              className="block text-center luxury-button-outline py-3"
            >
              Complete Verification
            </Link>
          </div>
        </div>
      </div>

      {/* Profile Sidebar */}
      <div className="space-y-6">
        <div className="glass-card p-6">
          <h2 className="font-serif text-xl font-bold text-accent-gold mb-4">Store Profile</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Business Type</label>
              <p className="capitalize opacity-80">Individual</p>
            </div>
            <Link 
              href="/dashboard/profile"
              className="luxury-button-outline w-full text-center py-3"
            >
              Edit Profile
            </Link>
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="font-serif text-xl font-bold text-accent-gold mb-4">Recent Activity</h2>
          <div className="space-y-3 text-sm">
            <p className="opacity-60">No recent activity</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function BuyerDashboard() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Recent Orders */}
      <div className="lg:col-span-2 space-y-6">
        <div className="glass-card p-6">
          <h2 className="font-serif text-xl font-bold text-accent-gold mb-4">Recent Orders</h2>
          <div className="text-center py-8 opacity-60">
            <p>No orders yet</p>
            <Link 
              href="/store"
              className="luxury-button-outline mt-4 px-6 py-2"
            >
              Start Shopping
            </Link>
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="font-serif text-xl font-bold text-accent-gold mb-4">Recommended for You</h2>
          <div className="text-center py-8 opacity-60">
            <p>Browse our categories to discover products you might like</p>
            <Link 
              href="/categories"
              className="luxury-button-outline mt-4 px-6 py-2"
            >
              Explore Categories
            </Link>
          </div>
        </div>
      </div>

      {/* Profile Sidebar */}
      <div className="space-y-6">
        <div className="glass-card p-6">
          <h2 className="font-serif text-xl font-bold text-accent-gold mb-4">Account</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Member Since</label>
              <p className="opacity-80">Today</p>
            </div>
            <Link 
              href="/dashboard/profile"
              className="luxury-button-outline w-full text-center py-3"
            >
              Edit Profile
            </Link>
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="font-serif text-xl font-bold text-accent-gold mb-4">Quick Links</h2>
          <div className="space-y-3">
            <Link 
              href="/dashboard/orders"
              className="block text-sm hover:text-accent-gold transition-colors"
            >
              Order History
            </Link>
            <Link 
              href="/dashboard/addresses"
              className="block text-sm hover:text-accent-gold transition-colors"
            >
              Shipping Addresses
            </Link>
            <Link 
              href="/dashboard/wishlist"
              className="block text-sm hover:text-accent-gold transition-colors"
            >
              Wishlist
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}