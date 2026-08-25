// app/api/products/[slug]/recommendations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logOperationalError } from "@/lib/observability/operationalEvent";

/**
 * GET /api/products/[slug]/recommendations
 * Returns recommended products based on category similarity
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const supabase = await createClient();

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
      logOperationalError("product_recommendations_query_failed", error, {
        component: "catalog",
        operation: "product-recommendations",
        route: "/api/products/[slug]/recommendations",
        recordId: product.id,
      });
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
    logOperationalError("product_recommendations_failed", error, {
      component: "catalog",
      operation: "product-recommendations",
      route: "/api/products/[slug]/recommendations",
    });
    return NextResponse.json({ recommendations: [] });
  }
}
