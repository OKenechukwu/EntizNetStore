import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LEGACY_LOCALE_KEYS,
  SUPPORTED_LOCALES,
  getLocaleDisplayName,
  parseLocale,
} from "@/lib/preferences";

export const DEFAULT_LANGUAGE = DEFAULT_LOCALE;
export const SUPPORTED_LANGUAGES = SUPPORTED_LOCALES.map(({ code, name, nativeName }) => ({ code, name, nativeName }));

export function getLanguageName(code: string): string {
  return parseLocale(code) ? getLocaleDisplayName(code) : code.toUpperCase();
}

export function getLanguageFromCookie(): string {
  if (typeof document === "undefined") return DEFAULT_LANGUAGE;
  const names = [LOCALE_COOKIE, ...LEGACY_LOCALE_KEYS];
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
    const parsed = parseLocale(match ? decodeURIComponent(match[1]) : null);
    if (parsed) return parsed;
  }
  return DEFAULT_LANGUAGE;
}
