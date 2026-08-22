import { NextRequest, NextResponse } from "next/server";
import { getStorefrontByIdentity } from "@/lib/data/storefront";

export const dynamic = "force-dynamic";

// Public storefront data (verified Seller profile + approved active products)
// from Supabase. RLS remains the final visibility boundary.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const data = await getStorefrontByIdentity(id, {
      q: searchParams.get("q") ?? undefined,
      page: Number(searchParams.get("page") ?? 1) || 1,
      pageSize: Number(searchParams.get("pageSize") ?? 24) || 24,
    });
    if (!data) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to load storefront:", error);
    return NextResponse.json({ error: "Failed to load storefront" }, { status: 500 });
  }
}
