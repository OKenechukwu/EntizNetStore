// lib/languages.ts

export const DEFAULT_LANGUAGE = "en";

/**
 * Top 20 world languages by number of speakers
 */
export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "ar", name: "Arabic", nativeName: "العربية" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "ur", name: "Urdu", nativeName: "اردو" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "sw", name: "Swahili", nativeName: "Kiswahili" },
  { code: "mr", name: "Marathi", nativeName: "मराठी" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe" },
  { code: "ko", name: "Korean", nativeName: "한국어" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt" },
  { code: "it", name: "Italian", nativeName: "Italiano" },
  { code: "th", name: "Thai", nativeName: "ไทย" },
  { code: "fil", name: "Filipino", nativeName: "Filipino" },
];

/**
 * Language display names for the UI
 */
export function getLanguageName(code: string): string {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
  return lang ? `${lang.nativeName} (${lang.name})` : code.toUpperCase();
}

/**
 * Read language preference from cookie
 */
export function getLanguageFromCookie(): string {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )language=([^;]*)`));
    const cookieValue = match ? decodeURIComponent(match[1]) : null;
    
    if (cookieValue && SUPPORTED_LANGUAGES.some(l => l.code === cookieValue)) {
      return cookieValue;
    }
  } catch {
    // Fall back to default
  }
  
  return DEFAULT_LANGUAGE;
}