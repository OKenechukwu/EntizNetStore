import { NextRequest, NextResponse } from "next/server";
import { getStorefront } from "@/lib/data/products";

export const dynamic = "force-dynamic";

// Public storefront data (seller profile + active products) from the live
// Neon Postgres database (see lib/db.ts).
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await getStorefront(params.id, {
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
    return NextResponse.json(
      { error: "Failed to load storefront" },
      { status: 500 }
    );
  }
}
