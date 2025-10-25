// components/store/StorePanel.tsx
"use client";

import Link from "next/link";
import { MessageCircle, ShieldCheck, Star, Users } from "lucide-react";
import { useBrand } from "@/components/BrandProvider";

interface StorePanelProps {
  storeId: string;
  storeName: string;
  rating?: number;          // e.g., 4.8
  reviewsCount?: number;    // e.g., 123
  followers?: number;       // e.g., 1200
  responseTime?: string;    // e.g., "~2h"
  verified?: boolean;       // default true
  className?: string;
}

export default function StorePanel({
  storeId,
  storeName,
  rating = 4.8,
  reviewsCount = 0,
  followers = 0,
  responseTime = "~2h",
  verified = true,
  className = "",
}: StorePanelProps) {
  const { theme } = useBrand();

  return (
    <aside
      className={`rounded-xl border p-4 ${className}`}
      style={{ borderColor: theme.colors.glass.border, backgroundColor: theme.colors.surface }}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
          {storeName}
        </div>
        {verified && (
          <span className="inline-flex items-center gap-1 text-xs font-medium">
            <ShieldCheck className="h-4 w-4" style={{ color: theme.colors.accent }} />
            <span style={{ color: theme.colors.text.secondary }}>Verified</span>
          </span>
        )}
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 text-sm">
        <div className="flex items-center gap-1" style={{ color: theme.colors.text.primary }}>
          <Star className="h-4 w-4" />
          {rating.toFixed(1)}
          <span className="text-xs opacity-60">&nbsp;({reviewsCount})</span>
        </div>
        <div className="flex items-center gap-1" style={{ color: theme.colors.text.primary }}>
          <Users className="h-4 w-4" />
          {followers.toLocaleString()} followers
        </div>
        <div className="text-xs" style={{ color: theme.colors.text.secondary }}>
          Avg. response {responseTime}
        </div>
      </div>

      <Link
        href={`/messages/new?storeId=${encodeURIComponent(storeId)}`}
        className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
        style={{ backgroundColor: theme.colors.accent, color: "white" }}
      >
        <MessageCircle className="h-4 w-4" />
        Chat with Store
      </Link>
    </aside>
  );
}
