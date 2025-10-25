// app/api/fx/route.ts
import { NextResponse } from "next/server";

// Optional (safe): ensure this route is treated as dynamic and can revalidate
export const dynamic = "force-dynamic";

/**
 * Proxy for live FX rates (base = USD).
 * Uses Frankfurter (free) and returns a trimmed set of currencies.
 * Adds caching headers for CDN/browser and server revalidation.
 */
export async function GET() {
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD", {
      // Server-side revalidation window (3 hours)
      next: { revalidate: 60 * 60 * 3 },
    });

    if (!res.ok) {
      throw new Error(`FX upstream error: ${res.status}`);
    }

    // Example response: { amount, base, date, rates: { EUR: 0.93, ... } }
    const data = (await res.json()) as {
      base?: string;
      date?: string;
      rates?: Record<string, number>;
    };

    // Keep only currencies we actually use (plus USD=1)
    const wanted = [
      "USD",
      "EUR",
      "GBP",
      "PHP",
      "JPY",
      "KRW",
      "AUD",
      "CAD",
      "NGN",
    ];
    const pick = (obj: Record<string, number> = {}, keys: string[]) =>
      keys.reduce(
        (acc, k) => {
          if (k === "USD") acc[k] = 1;
          else if (obj[k] != null) acc[k] = obj[k];
          return acc;
        },
        {} as Record<string, number>,
      );

    const rates = pick(data.rates, wanted);

    return NextResponse.json(
      { base: "USD", rates, date: data.date },
      {
        // CDN 3h, browser 30m (server revalidates every 3h via `next.revalidate`)
        headers: { "Cache-Control": "public, s-maxage=10800, max-age=1800" },
      },
    );
  } catch (err) {
    // Graceful fallback — client can decide to use static rates
    return NextResponse.json(
      {
        base: "USD",
        rates: null,
        error: (err as Error)?.message ?? "FX fetch failed",
      },
      { status: 200 },
    );
  }
}
