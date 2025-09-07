// app/api/fx/route.ts
import { NextResponse } from "next/server";
import { getFxRates, BASE_CURRENCY } from "@/lib/currency";

export async function GET() {
  const rates = await getFxRates(BASE_CURRENCY);
  return NextResponse.json({ base: BASE_CURRENCY, rates });
}
