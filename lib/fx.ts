import { BASE_CURRENCY, SUPPORTED_CURRENCIES, type FxRates } from "@/lib/currencyCore";
import { buildRatesUrl, parseRateRows, FxPolicyError } from "@/lib/fxCore";

export const FRANKFURTER_ORIGIN = "https://api.frankfurter.dev" as const;
export const FX_UPSTREAM_TIMEOUT_MS = 5_000;
export const FX_UPSTREAM_MAX_BYTES = 64 * 1024;

export class FxProviderError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "FxProviderError";
    this.code = code;
  }
}

export function buildFrankfurterRatesUrl(): string {
  try {
    return buildRatesUrl(
      FRANKFURTER_ORIGIN,
      BASE_CURRENCY,
      SUPPORTED_CURRENCIES.filter((code) => code !== BASE_CURRENCY),
    );
  } catch (error) {
    throw new FxProviderError(error instanceof FxPolicyError ? error.code : "unsafe_origin");
  }
}

export function parseFrankfurterPayload(payload: unknown): { rates: FxRates; asOf: string } {
  try {
    const parsed = parseRateRows(payload, BASE_CURRENCY, SUPPORTED_CURRENCIES);
    return { rates: parsed.rates as FxRates, asOf: parsed.asOf };
  } catch (error) {
    throw new FxProviderError(error instanceof FxPolicyError ? error.code : "invalid_payload");
  }
}

export async function fetchFrankfurterRates(fetchImpl: typeof fetch = fetch): Promise<{ rates: FxRates; asOf: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FX_UPSTREAM_TIMEOUT_MS);
  try {
    const url = buildFrankfurterRatesUrl();
    const parsed = new URL(url);
    if (parsed.origin !== FRANKFURTER_ORIGIN || parsed.protocol !== "https:") {
      throw new FxProviderError("unsafe_origin");
    }
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw new FxProviderError("upstream_status");
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("application/json")) throw new FxProviderError("unexpected_content_type");
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > FX_UPSTREAM_MAX_BYTES) throw new FxProviderError("response_too_large");
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > FX_UPSTREAM_MAX_BYTES) throw new FxProviderError("response_too_large");
    let payload: unknown;
    try {
      payload = JSON.parse(new TextDecoder().decode(buffer));
    } catch {
      throw new FxProviderError("invalid_json");
    }
    return parseFrankfurterPayload(payload);
  } catch (error) {
    if (error instanceof FxProviderError) throw error;
    if (controller.signal.aborted) throw new FxProviderError("timeout");
    throw new FxProviderError("network_failure");
  } finally {
    clearTimeout(timeout);
  }
}
