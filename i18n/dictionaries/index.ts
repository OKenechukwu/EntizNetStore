// i18n/dictionaries/index.ts
import { dict as en } from "./en";
import { dict as de } from "./de";
import { dict as fr } from "./fr";
import { dict as ja } from "./ja";
import { dict as th } from "./th";
import { dict as vi } from "./vi";
import { dict as zh } from "./zh";

export type Dict = typeof en;

export const DICTS: Record<string, Dict> = {
  en,
  de,
  fr,
  ja,
  th,
  vi,
  zh,
};
