// ---------- components/search/SearchBar.tsx ----------
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

/** Small debounce helper (no external deps) */
function debounce<F extends (...args: any[]) => void>(fn: F, delay = 180) {
  let t: number | undefined;
  return (...args: Parameters<F>) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), delay);
  };
}

type Suggestion = {
  type: "product" | "category" | "brand";
  id: string;
  label: string;
  href: string; // final navigation target
};

export default function SearchBar({
  placeholder = "Search products, categories, brands…",
  minChars = 2,
  className = "",
}: {
  placeholder?: string;
  minChars?: number;
  className?: string;
}) {
  const router = useRouter();

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [highlight, setHighlight] = useState<number>(-1);

  const boxRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setHighlight(-1);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Local fallback data (used if API not available or returns empty)
  const localBase = useMemo<Suggestion[]>(
    () => [
      { type: "category", id: "vibrators", label: "Vibrators", href: "/categories/vibrators" },
      { type: "category", id: "lingerie", label: "Lingerie", href: "/categories/lingerie-and-costumes" },
      { type: "category", id: "massage-oils", label: "Massage Oils", href: "/categories/massage-oils" },
      { type: "brand", id: "royal-desire", label: "Royal Desire™", href: "/brands/royal-desire" },
      { type: "product", id: "premium-body-wand", label: "Premium Body Wand", href: "/products/premium-body-wand" },
      { type: "product", id: "silk-blindfold", label: "Silk Blindfold", href: "/products/silk-blindfold" },
      { type: "product", id: "nuru-massage-gel", label: "Nuru Massage Gel", href: "/products/nuru-massage-gel" },
      { type: "product", id: "silk-touch-lube", label: "Silk Touch Lubricant", href: "/products/silk-touch-lube" },
    ],
    []
  );

  // Debounced suggestion fetcher: tries /api/suggest then falls back to local filter
  const fetchSuggestions = useMemo(
    () =>
      debounce(async (term: string) => {
        const needle = term.trim();
        if (!needle || needle.length < minChars) {
          setSuggestions([]);
          return;
        }

        // Try API first
        try {
          abortRef.current?.abort();
          const controller = new AbortController();
          abortRef.current = controller;

          const res = await fetch(`/api/suggest?q=${encodeURIComponent(needle)}`, {
            signal: controller.signal,
          });

          if (res.ok) {
            const data = await res.json();
            const items = Array.isArray(data.items) ? data.items : [];
            // Normalize to Suggestion shape if API returns {type,label,value}
            const normalized: Suggestion[] = items.slice(0, 12).map((it: any, idx: number) => {
              const t = it.type as "product" | "category" | "brand";
              const value = String(it.value ?? it.slug ?? it.id ?? idx);
              let href = "/";
              if (t === "product") href = `/products/${value}`;
              else if (t === "category") href = `/categories/${value}`;
              else href = `/brands/${value}`;
              return {
                type: t,
                id: value,
                label: String(it.label ?? it.name ?? value),
                href,
              };
            });

            if (normalized.length > 0) {
              setSuggestions(normalized);
              return;
            }
          }
        } catch {
          // ignore; will use fallback
        }

        // Fallback local filtering
        const low = needle.toLowerCase();
        const filtered = localBase
          .filter((s) => s.label.toLowerCase().includes(low))
          .slice(0, 8);
        setSuggestions(filtered);
      }, 180),
    [localBase, minChars]
  );

  const onChange = useCallback(
    (v: string) => {
      setQ(v);
      setOpen(true);
      fetchSuggestions(v);
    },
    [fetchSuggestions]
  );

  const submitSearch = useCallback(
    (term?: string) => {
      const value = (term ?? q).trim();
      if (!value) return;
      setOpen(false);
      setHighlight(-1);
      router.push(`/search?q=${encodeURIComponent(value)}`);
    },
    [q, router]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        submitSearch();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight >= 0 && suggestions[highlight]) {
        const s = suggestions[highlight];
        setOpen(false);
        setHighlight(-1);
        router.push(s.href);
      } else {
        submitSearch();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlight(-1);
    }
  };

  return (
    <div className={`relative ${className}`} ref={boxRef}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitSearch();
        }}
      >
        <div className="flex items-center rounded-full border px-3 py-2 focus-within:ring-2 focus-within:ring-pink-500">
          <Search className="mr-2 h-4 w-4 opacity-70" />
          <input
            value={q}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => q && q.length >= minChars && setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="w-72 bg-transparent text-sm outline-none placeholder:opacity-60"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-activedescendant={highlight >= 0 ? `suggestion-${highlight}` : undefined}
            aria-owns="search-suggestions"
            autoComplete="off"
          />
        </div>
      </form>

      {open && suggestions.length > 0 && (
        <div
          id="search-suggestions"
          className="absolute z-20 mt-2 w-[28rem] overflow-hidden rounded-xl border bg-background shadow-xl"
          role="listbox"
        >
          <div className="max-h-80 overflow-y-auto p-2">
            {suggestions.map((s, idx) => {
              const active = highlight === idx;
              return (
                <Link
                  key={s.type + s.id}
                  id={`suggestion-${idx}`}
                  role="option"
                  aria-selected={active}
                  href={s.href}
                  onMouseEnter={() => setHighlight(idx)}
                  onMouseDown={(e) => {
                    // prevent input blur before navigation
                    e.preventDefault();
                  }}
                  onClick={() => {
                    setOpen(false);
                    setHighlight(-1);
                  }}
                  className={`block rounded-md px-3 py-2 text-sm hover:bg-muted ${
                    active ? "bg-muted" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{s.label}</span>
                    <span className="text-xs uppercase opacity-60">{s.type}</span>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="border-t p-2 text-right text-xs opacity-60">
            Press Enter to search “{q}”
          </div>
        </div>
      )}
    </div>
  );
}
