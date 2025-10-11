"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MainSearchBar({
  placeholder = "Search products, brands, stores…",
  className = "",
}: {
  placeholder?: string;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const router = useRouter();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  return (
    <form
      onSubmit={onSubmit}
      role="search"
      className={[
        "mx-auto flex w-full max-w-3xl items-center rounded-[16px] border",
        "border-white/15 bg-white/10 backdrop-blur px-4 py-2",
        "shadow-[0_4px_24px_rgba(0,0,0,0.18)]",
        "focus-within:ring-2 focus-within:ring-[var(--brand-secondary,#D1B000)]",
        className,
      ].join(" ")}
    >
      <button
        type="submit"
        aria-label="Search"
        className="mr-3 grid h-9 w-9 place-items-center rounded-full bg-white/20"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20L16.65 16.65" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="h-10 flex-1 bg-transparent text-base outline-none placeholder:text-white/70"
      />
      {/* quick chips (optional) */}
      <div className="ml-3 hidden items-center gap-2 sm:flex">
        <span className="rounded-full bg-black/30 px-3 py-1 text-xs">
          Ship to
        </span>
        <span className="rounded-full bg-black/30 px-3 py-1 text-xs">
          € EUR
        </span>
      </div>
    </form>
  );
}
