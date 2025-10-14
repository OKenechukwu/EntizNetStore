// lib/i18n/dictionaries.ts
import { dict as en } from "@/i18n/dictionaries/en";
import { dict as de } from "@/i18n/dictionaries/de";
import { dict as fr } from "@/i18n/dictionaries/fr";
import { dict as ja } from "@/i18n/dictionaries/ja";
import { dict as zh } from "@/i18n/dictionaries/zh";
import { dict as vi } from "@/i18n/dictionaries/vi";
import { dict as th } from "@/i18n/dictionaries/th";

const MAP: Record<string, any> = { en, de, fr, ja, zh, vi, th };

export type Locale = keyof typeof MAP;

export function getDict(locale: string) {
  return MAP[locale as Locale] ?? en;
}
