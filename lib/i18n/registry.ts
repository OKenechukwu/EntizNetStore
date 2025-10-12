import type { Messages } from "./types";
import en from "@/i18n/messages/en.json";
import de from "@/i18n/messages/de.json";
import fr from "@/i18n/messages/fr.json";

// Register available locales here
export const MESSAGES: Record<string, Messages> = {
  en,
  de,
  fr,
};

// Helper to safely read nested keys like "home.bestSellingProducts"
export function getMessage(
  messages: Messages,
  path: string,
): string | undefined {
  return path
    .split(".")
    .reduce<any>(
      (acc, k) => (acc && acc[k] != null ? acc[k] : undefined),
      messages,
    );
}
