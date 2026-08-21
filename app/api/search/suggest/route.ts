// app/api/search/suggest/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

/**
 * GET /api/search/suggest?q=...
 * Returns top 8 product titles matching the search query
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() || "";

    if (!query || query.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const supabase = await createClient();

    // Search for products by title (case-insensitive, prefix match)
    const { data: products, error } = await supabase
      .from("products")
      .select("id, slug, title, image")
      .ilike("title", `%${query}%`)
      .limit(8);

    if (error) {
      console.error("Search suggest error:", error);
      return NextResponse.json({ suggestions: [] });
    }

    const suggestions = (products || []).map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      image: p.image,
    }));

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Search suggest error:", error);
    return NextResponse.json({ suggestions: [] });
  }
}
