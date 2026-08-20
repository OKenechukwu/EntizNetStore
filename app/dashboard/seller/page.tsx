// app/dashboard/seller/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function SellerDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth/sign-in");
      return;
    }
    // Bounce only users WITHOUT seller capability (canonical profile
    // presence), never based on client-mutable metadata.
    if (user.isSeller === false) {
      router.replace("/store");
    }
  }, [loading, user, router]);

  if (loading || !user || user.isSeller === false) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="opacity-80">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const storeSlug =
    (user.profile as any)?.store_slug ||
    (user.profile as any)?.storefront_name
      ?.toLowerCase?.()
      .replace(/[^a-z0-9]+/g, "-") ||
    user.id;

  const publicStorePath = `/store/${storeSlug}`;

  const userName =
    (user.profile as any)?.storefront_name ||
    (user.email ? user.email.split("@")[0] : "Seller");

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="glass-card p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-accent-gold mb-2">
              Welcome back, {userName}
            </h1>
            <p className="opacity-80">Manage your store and products</p>
          </div>
          <div
            aria-label="Account type"
            className="text-sm px-3 py-1 rounded-full bg-accent-gold/20 text-accent-gold font-medium capitalize"
          >
            {user.role}
          </div>
        </div>

        {/* Shareable store link */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={publicStorePath}
            className="luxury-button-outline px-4 py-2"
            target="_blank"
          >
            View Public Store
          </Link>
          <button
            className="luxury-button-outline px-4 py-2"
            onClick={() => {
              const url =
                typeof window !== "undefined"
                  ? new URL(publicStorePath, window.location.origin).toString()
                  : publicStorePath;
              navigator.clipboard.writeText(url);
              alert("Public store link copied!");
            }}
          >
            Copy Store Link
          </button>
        </div>
      </div>

      <SellerDashboardCards />
    </div>
  );
}

function SellerDashboardCards() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Quick Actions */}
      <div className="lg:col-span-2 space-y-6">
        <div className="glass-card p-6">
          <h2 className="font-serif text-xl font-bold text-accent-gold mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Link
              href="/dashboard/store/new"
              className="luxury-button text-center py-4"
            >
              Add Product
            </Link>
            <Link
              href="/dashboard/store"
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
              href="/dashboard/seller/analytics"
              className="luxury-button-outline text-center py-4"
            >
              Analytics
            </Link>
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="font-serif text-xl font-bold text-accent-gold mb-4">
            Store Status
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-charcoal/20">
              <span>Verification Status</span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-600/20 text-yellow-400 capitalize">
                {(user.profile as any)?.verification_status || "pending"}
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
          <h2 className="font-serif text-xl font-bold text-accent-gold mb-4">
            Store Profile
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Business Type
              </label>
              <p className="capitalize opacity-80">{(user.profile as any)?.business_type || "individual"}</p>
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
          <h2 className="font-serif text-xl font-bold text-accent-gold mb-4">
            Recent Activity
          </h2>
          <div className="space-y-3 text-sm">
            <p className="opacity-60">No recent activity</p>
          </div>
        </div>
      </div>
    </div>
  );
}
