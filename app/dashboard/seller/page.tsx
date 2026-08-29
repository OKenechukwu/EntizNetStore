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
      <div className="glass-card p-8">
        <div className="flex items-center justify-between gap-4">
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
              void navigator.clipboard.writeText(url);
              alert("Public store link copied!");
            }}
          >
            Copy Store Link
          </button>
          <Link href="/dashboard/seller/branding" className="luxury-button-outline px-4 py-2">
            Store Branding
          </Link>
        </div>
      </div>

      <SellerDashboardCards profile={user.profile} />
    </div>
  );
}

function SellerDashboardCards({ profile }: { profile: unknown }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="glass-card p-6">
          <h2 className="font-serif text-xl font-bold text-accent-gold mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              href="/dashboard/seller/branding"
              className="luxury-button-outline text-center py-4"
            >
              Logo & Banner
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
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-950 text-amber-100 capitalize">
                {(profile as any)?.verification_status || "pending"}
              </span>
            </div>
            <Link
              href="/dashboard/verification"
              className="block rounded-lg border border-amber-700 bg-amber-950 px-6 py-3 text-center font-medium text-amber-50 transition-all duration-300 hover:-translate-y-0.5 hover:bg-amber-900 hover:text-white"
            >
              Complete Verification
            </Link>
          </div>
        </div>
      </div>

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
              <p className="capitalize opacity-80">{(profile as any)?.business_type || "individual"}</p>
            </div>
            <Link
              href="/dashboard/seller/branding"
              className="luxury-button-outline block w-full text-center py-3"
            >
              Edit Logo & Banner
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
