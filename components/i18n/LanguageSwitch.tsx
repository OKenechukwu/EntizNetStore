"use client";

import { usePrefs } from "@/hooks/usePrefs";

// If you already have a languages list, import it:
// import { LANGUAGES } from '@/lib/languages';

// Fallback minimal list if you don't:
const FALLBACK_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
];

export default function LanguageSwitch({
  className = "",
}: {
  className?: string;
}) {
  const { lang, setLang } = usePrefs();

  const LANGS = FALLBACK_LANGUAGES; // or LANGUAGES if you have it.

  return (
    <label className={`inline-flex items-center gap-2 text-sm ${className}`}>
      <span className="sr-only">Language</span>
      <select
        aria-label="Language"
        className="rounded-md border border-white/20 bg-white/5 px-2 py-1 outline-none hover:bg-white/10"
        value={lang}
        onChange={(e) => setLang(e.target.value)}
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
