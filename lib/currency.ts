import {
  CURRENCY_CHANGE_EVENT,
  CURRENCY_COOKIE,
  CURRENCY_STORAGE_KEY,
  LEGACY_CURRENCY_KEYS,
} from "@/lib/preferences";
import {
  BASE_CURRENCY,
  DEFAULT_CURRENCY,
  FALLBACK_RATES,
  coerceFxRates,
  toCurrencyCode,
  type CurrencyCode,
  type FxRates,
  type FxSnapshot,
} from "@/lib/currencyCore";

export * from "@/lib/currencyCore";

const FX_STORAGE_KEY = "entiz_fx_snapshot_v2";
const LEGACY_FX_STORAGE_KEY = "entiz_fx_rates_v1";
const FX_MAX_AGE_MS = 1000 * 60 * 60 * 6;
const FX_CLIENT_TIMEOUT_MS = 6_000;
const FX_CLIENT_MAX_BYTES = 64 * 1024;

function isBrowser() {
  return typeof window !== "undefined";
}

function readCookie(name: string): string | null {
  if (!isBrowser()) return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCanonicalCurrency(currency: CurrencyCode) {
  if (!isBrowser()) return;
  document.cookie = `${CURRENCY_COOKIE}=${encodeURIComponent(currency)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  try {
    localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
    for (const legacy of LEGACY_CURRENCY_KEYS) localStorage.removeItem(legacy);
  } catch {}
  for (const legacy of LEGACY_CURRENCY_KEYS) {
    document.cookie = `${legacy}=; path=/; max-age=0; samesite=lax`;
  }
}

export function getActiveCurrency(): CurrencyCode {
  const canonical = readCookie(CURRENCY_COOKIE);
  if (canonical) return toCurrencyCode(canonical);
  for (const legacy of LEGACY_CURRENCY_KEYS) {
    const value = readCookie(legacy);
    if (value) return toCurrencyCode(value);
  }
  if (isBrowser()) {
    try {
      return toCurrencyCode(
        localStorage.getItem(CURRENCY_STORAGE_KEY) ||
        LEGACY_CURRENCY_KEYS.map((key) => localStorage.getItem(key)).find(Boolean),
      );
    } catch {}
  }
  return DEFAULT_CURRENCY;
}

export function setActiveCurrency(value: CurrencyCode) {
  const currency = toCurrencyCode(value);
  writeCanonicalCurrency(currency);
  if (isBrowser()) {
    window.dispatchEvent(new CustomEvent(CURRENCY_CHANGE_EVENT, { detail: { currency } }));
  }
}

function parseStoredSnapshot(value: unknown): FxSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const rates = coerceFxRates(source.rates);
  if (!rates) return null;
  const savedAt = typeof source.savedAt === "number" ? source.savedAt : 0;
  const age = Date.now() - savedAt;
  return {
    base: BASE_CURRENCY,
    rates,
    asOf: typeof source.asOf === "string" ? source.asOf : "unknown",
    source: "cache",
    stale: !(age >= 0 && age <= FX_MAX_AGE_MS),
  };
}

export function getStoredFxSnapshot(): FxSnapshot | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(FX_STORAGE_KEY);
    if (raw) return parseStoredSnapshot(JSON.parse(raw));
    const legacy = localStorage.getItem(LEGACY_FX_STORAGE_KEY);
    if (!legacy) return null;
    const rates = coerceFxRates(JSON.parse(legacy));
    return rates ? { base: BASE_CURRENCY, rates, asOf: "legacy-cache", source: "cache", stale: true } : null;
  } catch {
    return null;
  }
}

export function getStoredFxRates(): FxRates | null {
  return getStoredFxSnapshot()?.rates ?? null;
}

function saveFxSnapshot(snapshot: FxSnapshot) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(FX_STORAGE_KEY, JSON.stringify({
      base: BASE_CURRENCY,
      rates: snapshot.rates,
      asOf: snapshot.asOf,
      savedAt: Date.now(),
    }));
    localStorage.removeItem(LEGACY_FX_STORAGE_KEY);
    localStorage.removeItem("entiz_fx_rates_ts_v1");
  } catch {}
}

export function saveFxRates(rates: FxRates) {
  const valid = coerceFxRates(rates);
  if (!valid) return;
  saveFxSnapshot({ base: BASE_CURRENCY, rates: valid, asOf: "manual-cache", source: "cache", stale: false });
}

async function fetchFxSnapshot(): Promise<FxSnapshot | null> {
  if (!isBrowser()) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FX_CLIENT_TIMEOUT_MS);
  try {
    const response = await fetch("/api/fx", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const length = Number(response.headers.get("content-length") || 0);
    if (length > FX_CLIENT_MAX_BYTES) return null;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > FX_CLIENT_MAX_BYTES) return null;
    const payload = JSON.parse(new TextDecoder().decode(buffer)) as Record<string, unknown>;
    if (payload.base !== BASE_CURRENCY) return null;
    const rates = coerceFxRates(payload.rates);
    if (!rates) return null;
    return {
      base: BASE_CURRENCY,
      rates,
      asOf: typeof payload.asOf === "string" ? payload.asOf : "unknown",
      source: payload.source === "frankfurter-v2" ? "live" : "fallback",
      stale: payload.stale === true,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getFxRates(options: { force?: boolean } = {}): Promise<FxRates> {
  const stored = getStoredFxSnapshot();
  if (!options.force && stored && !stored.stale) return stored.rates;
  const remote = await fetchFxSnapshot();
  if (remote) {
    saveFxSnapshot(remote);
    return remote.rates;
  }
  if (stored) return stored.rates;
  return FALLBACK_RATES;
}
