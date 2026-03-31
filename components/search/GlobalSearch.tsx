// components/search/GlobalSearch.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import I18nText from "@/components/i18n/I18nText";

type ProductLite = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  image?: string;
};

export default function GlobalSearch() {
  const router = useRouter();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") || "");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ProductLite[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // keep input in sync when URL changes
  useEffect(() => {
    const next = params.get("q") || "";
    setQ(next);
  }, [params]);

  // Close on outside click or on Esc
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Debounced fetch for suggestions
  useEffect(() => {
    if (!q.trim()) {
      setItems([]);
      return;
    }

    const id = setTimeout(async () => {
      try {
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({ items: [] }));
        setItems(Array.isArray(json?.items) ? json.items.slice(0, 8) : []);
        setOpen(true);
      } catch {
        // ignore aborted/failed
      }
    }, 160);

    return () => clearTimeout(id);
  }, [q]);

  function submit() {
    const term = q.trim();
    setOpen(false);
    router.push(term ? `/search?q=${encodeURIComponent(term)}` : `/search`);
  }

  function goToProduct(slug: string) {
    setOpen(false);
    router.push(`/products/${slug}`);
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex w-full items-center gap-2 rounded-full border px-3 py-2"
        style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.25)" }}
        role="search"
      >
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (e.target.value.trim()) setOpen(true);
          }}
          onFocus={() => q.trim() && setOpen(true)}
          placeholder="Search products…"
          className="w-full bg-transparent outline-none"
        />
        <button
          type="submit"
          className="rounded-full px-3 py-1 text-sm font-medium hover:opacity-80"
          style={{ background: "var(--brand-secondary, #D1B000)", color: "#000" }}
        >
          Search
        </button>
      </form>

      {/* Typeahead Panel (keeps brand look, appears below input) */}
      {open && items.length > 0 && (
        <div
          className="
            absolute left-0 right-0 mt-2 z-50
            rounded-lg border border-white/10
            bg-black/85 backdrop-blur p-2
          "
        >
          {items.map((p) => (
            <button
              key={p.id}
              onClick={() => goToProduct(p.slug)}
              className="w-full flex items-center gap-3 px-2 py-2 rounded hover:bg-white/10 text-left"
            >
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image}
                  alt={p.title}
                  width={40}
                  height={40}
                  className="rounded object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded bg-white/10" />
              )}
              <div className="min-w-0">
                <div className="text-sm font-medium truncate"><I18nText text={p.title} /></div>
                {p.description ? (
                  <div className="text-xs opacity-70 line-clamp-1">{p.description}</div>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
