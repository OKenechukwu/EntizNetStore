// components/layout/SearchSuggestions.tsx
"use client";

import { useState, useEffect, useRef, useCallback, useId } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import I18nText from "@/components/i18n/I18nText";

type Suggestion = {
  id: string;
  slug: string;
  title: string;
  image?: string;
};

type Props = {
  className?: string;
};

const DEBOUNCE_MS = 250;
const SEARCH_PLACEHOLDER_FALLBACK = "Search products, brands, and stores";
const SEARCH_ARIA_FALLBACK = "Search EntizNetStore";

export default function SearchSuggestions({ className }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const instanceId = useId();
  const listboxId = `${instanceId}-search-suggestions`;
  const searchPlaceholder = t("search.placeholder", SEARCH_PLACEHOLDER_FALLBACK);
  const searchAria = t("search.aria", SEARCH_ARIA_FALLBACK);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | undefined>(undefined);

  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([]);
      setSelectedIndex(-1);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(searchQuery)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Search suggestions failed with HTTP ${res.status}`);
      const data = await res.json();
      const nextSuggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
      setSuggestions(nextSuggestions);
      setSelectedIndex(-1);
      setIsOpen(nextSuggestions.length > 0);
    } catch {
      setSuggestions([]);
      setSelectedIndex(-1);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (query.trim().length < 2) {
      setSuggestions([]);
      setSelectedIndex(-1);
      setIsOpen(false);
      return;
    }

    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(query.trim());
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query, fetchSuggestions]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === "Escape") {
        setIsOpen(false);
        setSelectedIndex(-1);
        setQuery("");
        inputRef.current?.blur();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          window.location.href = `/products/${suggestions[selectedIndex].slug}`;
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const activeOptionId =
    isOpen && selectedIndex >= 0
      ? `${listboxId}-option-${suggestions[selectedIndex]?.id}`
      : undefined;

  return (
    <div className={`relative w-full ${className || ""}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-foreground/50 focus:border-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-secondary/20"
          aria-label={searchAria}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-activedescendant={activeOptionId}
        />
      </div>

      {isOpen && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          id={listboxId}
          role="listbox"
          aria-label={searchAria}
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[400px] overflow-y-auto rounded-lg border border-white/10 bg-black/95 backdrop-blur-md shadow-xl"
        >
          {suggestions.map((item, index) => (
            <Link
              id={`${listboxId}-option-${item.id}`}
              key={item.id}
              href={`/products/${item.slug}`}
              role="option"
              aria-selected={index === selectedIndex}
              className={`flex items-center gap-3 border-b border-white/5 p-3 transition last:border-0 hover:bg-white/10 ${
                index === selectedIndex ? "bg-white/10" : ""
              }`}
              onClick={() => {
                setIsOpen(false);
                setSelectedIndex(-1);
                setQuery("");
              }}
            >
              {item.image && (
                <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded">
                  <Image
                    src={item.image}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                </div>
              )}
              <div className="flex-1 text-sm">
                <div className="line-clamp-2 font-medium"><I18nText text={item.title} /></div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {isLoading && query.length >= 2 && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2" aria-hidden="true">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-secondary border-t-transparent" />
        </div>
      )}
    </div>
  );
}
