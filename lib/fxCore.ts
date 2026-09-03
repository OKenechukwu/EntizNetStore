export class FxPolicyError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "FxPolicyError";
    this.code = code;
  }
}

export function buildRatesUrl(origin: string, base: string, quotes: readonly string[]): string {
  const url = new URL("/v2/rates", origin);
  if (url.protocol !== "https:" || url.origin !== origin) throw new FxPolicyError("unsafe_origin");
  url.searchParams.set("base", base);
  url.searchParams.set("quotes", quotes.join(","));
  return url.toString();
}

export function parseRateRows(
  payload: unknown,
  base: string,
  supported: readonly string[],
): { rates: Record<string, number>; asOf: string } {
  if (!Array.isArray(payload)) throw new FxPolicyError("invalid_shape");
  const rates: Record<string, number> = { [base]: 1 };
  const seen = new Set<string>([base]);
  const dates: string[] = [];

  for (const row of payload) {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new FxPolicyError("invalid_row");
    const value = row as Record<string, unknown>;
    if (value.base !== base) throw new FxPolicyError("unexpected_base");
    if (typeof value.quote !== "string") throw new FxPolicyError("invalid_quote");
    const quote = value.quote.toUpperCase();
    if (!supported.includes(quote) || quote === base) throw new FxPolicyError("unexpected_quote");
    if (seen.has(quote)) throw new FxPolicyError("duplicate_quote");
    if (typeof value.rate !== "number" || !Number.isFinite(value.rate) || value.rate <= 0) {
      throw new FxPolicyError("invalid_rate");
    }
    if (typeof value.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) {
      throw new FxPolicyError("invalid_date");
    }
    rates[quote] = value.rate;
    seen.add(quote);
    dates.push(value.date);
  }

  for (const code of supported) {
    if (!seen.has(code)) throw new FxPolicyError("incomplete_rates");
  }
  return { rates, asOf: dates.sort().at(-1) || "unknown" };
}
