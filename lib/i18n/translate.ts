export async function translate(
  text: string,
  targetLang: string,
  opts?: { sourceLang?: string; formality?: "default" | "more" | "less" },
) {
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, targetLang, ...opts }),
  });
  if (!res.ok) throw new Error(await res.text());
  const { translated } = await res.json();
  return translated as string;
}
