import ar from "@/locales/ar.json";
import de from "@/locales/de.json";
import en from "@/locales/en.json";
import es from "@/locales/es.json";
import fr from "@/locales/fr.json";
import hi from "@/locales/hi.json";
import id from "@/locales/id.json";
import ja from "@/locales/ja.json";
import pt from "@/locales/pt.json";
import ru from "@/locales/ru.json";
import th from "@/locales/th.json";
import zh from "@/locales/zh.json";
import { DEFAULT_LOCALE, type SupportedLocale, toLocale } from "@/lib/preferences";

export type Dictionary = Record<string, unknown>;
const ENGLISH = en as Dictionary;
const RAW_DICTIONARIES: Record<SupportedLocale, Dictionary> = {
  ar: ar as Dictionary,
  de: de as Dictionary,
  en: ENGLISH,
  es: es as Dictionary,
  fr: fr as Dictionary,
  hi: hi as Dictionary,
  id: id as Dictionary,
  ja: ja as Dictionary,
  pt: pt as Dictionary,
  ru: ru as Dictionary,
  th: th as Dictionary,
  zh: zh as Dictionary,
};

function isObject(value: unknown): value is Dictionary {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function mergeDictionary(base: Dictionary, override: Dictionary): Dictionary {
  const merged: Dictionary = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = merged[key];
    merged[key] = isObject(current) && isObject(value)
      ? mergeDictionary(current, value)
      : value;
  }
  return merged;
}

const DICTIONARIES = Object.fromEntries(
  Object.entries(RAW_DICTIONARIES).map(([locale, dictionary]) => [
    locale,
    locale === DEFAULT_LOCALE ? ENGLISH : mergeDictionary(ENGLISH, dictionary),
  ]),
) as Record<SupportedLocale, Dictionary>;

export type Locale = SupportedLocale;
export function getDictionary(locale?: string | null): Dictionary {
  return DICTIONARIES[toLocale(locale)];
}
export const getDict = getDictionary;

export function resolveDictionaryValue(dictionary: Dictionary, key: string): unknown {
  return key.split(".").reduce<unknown>((value, segment) => {
    if (!isObject(value)) return undefined;
    return value[segment];
  }, dictionary);
}

export function getEnglishDictionary(): Dictionary {
  return DICTIONARIES.en;
}
