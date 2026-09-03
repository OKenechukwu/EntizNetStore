import { NextResponse } from "next/server";
import { BASE_CURRENCY, FALLBACK_RATES } from "@/lib/currency";
import { fetchFrankfurterRates, FxProviderError } from "@/lib/fx";

export const dynamic = "force-dynamic";

const LIVE_CACHE_CONTROL = "public, s-maxage=10800, stale-while-revalidate=3600, max-age=1800";
const FALLBACK_CACHE_CONTROL = "no-store, max-age=0";

function fallbackResponse(source = "fallback") {
  return NextResponse.json(
    {
      base: BASE_CURRENCY,
      rates: FALLBACK_RATES,
      asOf: "static-fallback",
      source,
      stale: true,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": FALLBACK_CACHE_CONTROL,
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

export async function GET() {
  // Browser/security CI must not depend on a public third-party service. The
  // remote boundary is covered by deterministic provider tests instead.
  if (process.env.CI === "true") return fallbackResponse("ci-fallback");

  try {
    const snapshot = await fetchFrankfurterRates();
    return NextResponse.json(
      {
        base: BASE_CURRENCY,
        rates: snapshot.rates,
        asOf: snapshot.asOf,
        source: "frankfurter-v2",
        stale: false,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": LIVE_CACHE_CONTROL,
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error) {
    const code = error instanceof FxProviderError ? error.code : "unexpected";
    console.warn("[fx] live display rates unavailable", { code });
    return fallbackResponse();
  }
}
