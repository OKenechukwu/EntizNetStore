// i18n/dictionaries/index.ts
import { dict as en } from "./en";
import { dict as de } from "./de";
import { dict as fr } from "./fr";
import { dict as ja } from "./ja";
import { dict as th } from "./th";
import { dict as vi } from "./vi";
import { dict as zh } from "./zh";

export type Dict = typeof en;

// Locale dictionaries have diverged in shape (en is nested, others are
// partially flat); consumers must treat values as unknown and narrow.
export const DICTS: Record<string, Record<string, unknown>> = {
  en,
  de,
  fr,
  ja,
  th,
  vi,
  zh,
};
