// app/api/suggest/route.ts
import { NextRequest, NextResponse } from "next/server";

type Kind = "product" | "category" | "brand";

type SuggestItem = {
  type: Kind;
  label: string;
  value: string; // slug or term
};

// Local fallback data so suggestions never feel dead
const FALLBACK: SuggestItem[] = [
  { type: "category", label: "Vibrators", value: "vibrators" },
  { type: "category", label: "Massage Oils", value: "massage-oils" },
  { type: "category", label: "Lingerie", value: "lingerie-and-costumes" },
  { type: "product",  label: "Premium Body Wand", value: "premium-body-wand" },
  { type: "product",  label: "Silk Blindfold", value: "silk-blindfold" },
  { type: "product",  label: "Nuru Massage Gel", value: "nuru-massage-gel" },
  { type: "brand",    label: "Royal Desire™", value: "royal-desire" },
];

// Optional: hint Next to avoid caching this route
export const revalidate = 0;

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function dedupe(items: SuggestItem[]): SuggestItem[] {
  const seen = new Set<string>();
  const out: SuggestItem[] = [];
  for (const it of items) {
    const key = `${it.type}:${it.value}`.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(it);
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("q") || "").trim();
  const limit = Math.max(1, Math.min(parseInt(searchParams.get("limit") || "12", 10) || 12, 20));
  const q = raw.slice(0, 64).toLowerCase(); // clamp length + normalize

  if (!q || q.length < 2) {
    return json({ items: [] });
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Try Supabase first (if configured)
  try {
    if (SUPABASE_URL && SERVICE_KEY) {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

      // Products
      const { data: prod, error: prodErr } = await supabase
        .from("products")
        .select("title, slug")
        .ilike("title", `%${q}%`)
        .limit(Math.min(6, limit));

      // Categories (if table exists)
      const { data: cats, error: catErr } = await supabase
        .from("categories")
        .select("name, slug")
        .ilike("name", `%${q}%`)
        .limit(Math.min(4, limit));

      // Brands (optional)
      let brands: { name: string; slug: string }[] | null = null;
      try {
        const { data: br, error: brErr } = await supabase
          .from("brands")
          .select("name, slug")
          .ilike("name", `%${q}%`)
          .limit(Math.min(4, limit));
        if (!brErr) brands = br ?? null;
      } catch {
        // table may not exist — ignore silently
      }

      if (prodErr || catErr) {
        // If Supabase throws, we’ll fall back below
      }

      const items: SuggestItem[] = dedupe(
        [
          ...(cats?.map(c => ({ type: "category" as const, label: c.name, value: c.slug })) ?? []),
          ...(brands?.map(b => ({ type: "brand" as const, label: b.name, value: b.slug })) ?? []),
          ...(prod?.map(p => ({ type: "product" as const, label: p.title, value: p.slug })) ?? []),
        ].slice(0, limit)
      );

      if (items.length > 0) {
        return json({ items });
      }
    }
  } catch {
    // Ignore and use fallback
  }

  // Local fallback filter (ensures UI is responsive without DB)
  const filtered = FALLBACK.filter(i => i.label.toLowerCase().includes(q)).slice(0, limit);
  return json({ items: filtered });
}
