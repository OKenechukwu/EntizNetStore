"use client";

export function useSendMessage({
  recipientLang,
  sourceLang,
}: {
  recipientLang: string; // e.g. "de"
  sourceLang?: string; // e.g. "en"
}) {
  async function send(text: string) {
    const res = await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, recipientLang, sourceLang }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Failed to send");
    // data = { ok: true, original, translated }
    return data as { ok: boolean; original: string; translated: string };
  }

  return { send };
}
