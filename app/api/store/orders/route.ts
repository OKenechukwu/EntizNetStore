// app/api/store/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type OrderItem = {
  id: string;
  qty: number;
};

type OrderRequest = {
  items: OrderItem[];
  subtotalBase?: number;
};

export async function POST(request: NextRequest) {
  try {
    const body: OrderRequest = await request.json();
    const { items } = body;

    // Validate request
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Invalid items array" },
        { status: 400 }
      );
    }

    // Validate each item
    for (const item of items) {
      if (!item.id || typeof item.qty !== "number" || item.qty < 1) {
        return NextResponse.json(
          { error: "Invalid item: id and qty >= 1 required" },
          { status: 400 }
        );
      }
    }

    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Fetch product prices from database to compute authoritative total
    const productIds = items.map(item => item.id);
    const { data: products, error } = await supabase
      .from("products")
      .select("id, price")
      .in("id", productIds);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch product data" },
        { status: 500 }
      );
    }

    if (!products || products.length !== productIds.length) {
      return NextResponse.json(
        { error: "One or more products not found" },
        { status: 400 }
      );
    }

    // Compute authoritative subtotal in USD
    let subtotalBase = 0;
    for (const item of items) {
      const product = products.find(p => p.id === item.id);
      if (!product || typeof product.price !== "number") {
        return NextResponse.json(
          { error: `Invalid product price for ${item.id}` },
          { status: 400 }
        );
      }
      subtotalBase += product.price * item.qty;
    }

    // Round to 2 decimal places
    subtotalBase = Math.round(subtotalBase * 100) / 100;

    // Generate a fake order ID (in real implementation, this would be stored in DB)
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Return success response
    return NextResponse.json(
      {
        id: orderId,
        subtotalBase
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Order processing error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}