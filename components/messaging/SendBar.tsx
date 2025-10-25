"use client";

import { useState, useRef, useEffect } from "react";
import { useSendMessage } from "./hooks/useSendMessage";

export default function SendBar({
  recipientLang,
  sourceLang,
  onDeliver,
  placeholder = "Type your message…",
}: {
  recipientLang: string;
  sourceLang?: string;
  onDeliver?: (msg: { original: string; translated: string }) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const { send } = useSendMessage({ recipientLang, sourceLang });
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSend() {
    const clean = text.trim();
    if (!clean || busy) return;
    setBusy(true);
    try {
      const data = await send(clean);
      onDeliver?.({ original: data.original, translated: data.translated });
      setText("");
      // optional: emit a browser event so other parts can listen if needed
      window.dispatchEvent(
        new CustomEvent("entiznet:chat:sent", { detail: data }),
      );
    } catch (e: any) {
      alert(e?.message || "Failed to send");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Autofocus when mounted
  useEffect(() => inputRef.current?.focus(), []);

  return (
    <div className="flex w-full gap-2 border-t border-white/10 bg-black/20 p-2">
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="flex-1 rounded-lg bg-black/40 px-3 py-2 text-white placeholder-white/50 outline-none ring-1 ring-white/10 focus:ring-2"
      />
      <button
        onClick={handleSend}
        disabled={busy}
        className="rounded-lg px-4 py-2 font-bold text-white bg-pink-600 disabled:opacity-50"
      >
        {busy ? "Sending…" : "Send"}
      </button>
    </div>
  );
}
