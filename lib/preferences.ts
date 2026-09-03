export const DEFAULT_LOCALE = "en" as const;
export const LOCALE_COOKIE = "entiz_locale" as const;
export const CURRENCY_COOKIE = "entiz_currency" as const;
export const LOCALE_STORAGE_KEY = LOCALE_COOKIE;
export const CURRENCY_STORAGE_KEY = CURRENCY_COOKIE;
export const LOCALE_CHANGE_EVENT = "entiz:locale-change" as const;
export const CURRENCY_CHANGE_EVENT = "entiz:currency-change" as const;

export const LEGACY_LOCALE_KEYS = ["locale", "language"] as const;
export const LEGACY_CURRENCY_KEYS = ["currency"] as const;

export type LocaleDirection = "ltr" | "rtl";

export const SUPPORTED_LOCALES = [
  { code: "en", shortLabel: "EN", name: "English", nativeName: "English", direction: "ltr" },
  { code: "de", shortLabel: "DE", name: "German", nativeName: "Deutsch", direction: "ltr" },
  { code: "es", shortLabel: "ES", name: "Spanish", nativeName: "Español", direction: "ltr" },
  { code: "fr", shortLabel: "FR", name: "French", nativeName: "Français", direction: "ltr" },
  { code: "pt", shortLabel: "PT", name: "Portuguese", nativeName: "Português", direction: "ltr" },
  { code: "hi", shortLabel: "HI", name: "Hindi", nativeName: "हिन्दी", direction: "ltr" },
  { code: "id", shortLabel: "ID", name: "Indonesian", nativeName: "Bahasa Indonesia", direction: "ltr" },
  { code: "ja", shortLabel: "JA", name: "Japanese", nativeName: "日本語", direction: "ltr" },
  { code: "zh", shortLabel: "ZH", name: "Chinese", nativeName: "中文", direction: "ltr" },
  { code: "th", shortLabel: "TH", name: "Thai", nativeName: "ไทย", direction: "ltr" },
  { code: "ru", shortLabel: "RU", name: "Russian", nativeName: "Русский", direction: "ltr" },
  { code: "ar", shortLabel: "AR", name: "Arabic", nativeName: "العربية", direction: "rtl" },
] as const satisfies ReadonlyArray<{
  code: string;
  shortLabel: string;
  name: string;
  nativeName: string;
  direction: LocaleDirection;
}>;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]["code"];

const LOCALE_CODES = new Set<string>(SUPPORTED_LOCALES.map((locale) => locale.code));

export function parseLocale(value?: string | null): SupportedLocale | null {
  const normalized = (value || "").trim().toLowerCase().replace(/_/g, "-");
  if (!normalized) return null;
  if (LOCALE_CODES.has(normalized)) return normalized as SupportedLocale;
  const base = normalized.split("-")[0];
  return LOCALE_CODES.has(base) ? (base as SupportedLocale) : null;
}

export function toLocale(value?: string | null): SupportedLocale {
  return parseLocale(value) || DEFAULT_LOCALE;
}

export function getLocaleMetadata(value?: string | null) {
  const locale = toLocale(value);
  return SUPPORTED_LOCALES.find((candidate) => candidate.code === locale)!;
}

export function getLocaleDirection(value?: string | null): LocaleDirection {
  return getLocaleMetadata(value).direction;
}

export function getLocaleDisplayName(value?: string | null): string {
  const locale = getLocaleMetadata(value);
  return `${locale.nativeName} (${locale.name})`;
}
