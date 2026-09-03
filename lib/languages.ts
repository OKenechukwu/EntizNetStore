import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  getLocaleMetadata,
  toLocale,
} from "@/lib/preferences";

/** Backward-compatible aliases over the canonical locale registry. */
export const DEFAULT_LANGUAGE = DEFAULT_LOCALE;
export const SUPPORTED_LANGUAGES = SUPPORTED_LOCALES.map((locale) => ({
  code: locale.code,
  name: locale.name,
  nativeName: locale.nativeName,
}));

export function getLanguageName(code: string): string {
  const locale = getLocaleMetadata(code);
  return `${locale.nativeName} (${locale.name})`;
}

export function getLanguageFromCookie(): string {
  if (typeof document === "undefined") return DEFAULT_LANGUAGE;
  try {
    const canonical = document.cookie.match(/(?:^|; )entiz_locale=([^;]*)/);
    if (canonical) return toLocale(decodeURIComponent(canonical[1]));
    for (const legacy of ["locale", "language"]) {
      const escaped = legacy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
      if (match) return toLocale(decodeURIComponent(match[1]));
    }
  } catch {}
  return DEFAULT_LANGUAGE;
}
