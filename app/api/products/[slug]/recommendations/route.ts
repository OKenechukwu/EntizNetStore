// app/api/products/[slug]/recommendations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

/**
 * GET /api/products/[slug]/recommendations
 * Returns recommended products based on category similarity
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const supabase = createClient();

    // Get the product to find its category
    const { data: product } = await supabase
      .from("products")
      .select("id, category")
      .eq("slug", slug)
      .single();

    if (!product) {
      return NextResponse.json({ recommendations: [] });
    }

    // Get products in the same category (excluding current product)
    const { data: recommendations, error } = await supabase
      .from("products")
      .select("id, slug, title, basePrice, images, brand, rating, reviewCount")
      .eq("category", product.category)
      .neq("id", product.id)
      .limit(8);

    if (error) {
      console.error("Recommendations error:", error);
      return NextResponse.json({ recommendations: [] });
    }

    // Transform to Product type structure
    const formattedRecommendations = (recommendations || []).map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      basePrice: p.basePrice,
      images: Array.isArray(p.images) ? p.images : [{ url: p.images }],
      brand: p.brand,
      rating: p.rating,
      reviewCount: p.reviewCount,
    }));

    return NextResponse.json({ recommendations: formattedRecommendations });
  } catch (error) {
    console.error("Recommendations error:", error);
    return NextResponse.json({ recommendations: [] });
  }
}
