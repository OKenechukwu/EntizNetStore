"use client";

import { useState } from "react";

export default function TranslateTester() {
  const [text, setText] = useState("Hello, how are you today?");
  const [targetLang, setTargetLang] = useState("fr");
  const [sourceLang, setSourceLang] = useState("");
  const [out, setOut] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const langs = [
    "ar",
    "bg",
    "cs",
    "da",
    "de",
    "el",
    "en",
    "es",
    "et",
    "fi",
    "fr",
    "hu",
    "id",
    "it",
    "ja",
    "ko",
    "lt",
    "lv",
    "nl",
    "pl",
    "pt",
    "ro",
    "ru",
    "sk",
    "sl",
    "sv",
    "th",
    "tr",
    "uk",
    "vi",
    "zh",
  ];

  async function run() {
    setBusy(true);
    setOut("");
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          targetLang,
          sourceLang: sourceLang || undefined,
          formality: "default",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      setOut(data.translated);
    } catch (e: any) {
      setOut(`Error: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen p-6 flex flex-col gap-4">
      <h1 className="text-2xl font-bold">DeepL Translate Tester</h1>
      <textarea
        className="w-full h-40 p-3 rounded border border-white/20 bg-black/20"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex gap-3 items-center">
        <label className="text-sm opacity-80">Target</label>
        <select
          className="px-2 py-1 rounded bg-black/20 border border-white/20"
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
        >
          {langs.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>

        <label className="text-sm opacity-80">Source (optional)</label>
        <input
          className="px-2 py-1 rounded bg-black/20 border border-white/20 w-24"
          placeholder="auto"
          value={sourceLang}
          onChange={(e) => setSourceLang(e.target.value)}
        />

        <button
          onClick={run}
          disabled={busy || !text.trim()}
          className="px-4 py-2 rounded bg-pink-600 text-white disabled:opacity-50"
        >
          {busy ? "Translating…" : "Translate"}
        </button>
      </div>

      <div className="mt-4">
        <div className="text-sm opacity-80 mb-1">Output</div>
        <div className="p-3 rounded border border-white/20 bg-black/10 min-h-[60px] whitespace-pre-wrap">
          {out || "—"}
        </div>
      </div>
    </main>
  );
}
