"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Brand,
  BrandConfig,
  getCurrentBrand,
  getBrandConfig,
} from "@/lib/brand";
import { applyBrandTheme, getBrandTheme, BrandTheme } from "@/lib/brand-theme";

type ThemeMode = "light" | "dark" | "system";

type BrandContextType = {
  brand: Brand;
  config: BrandConfig;
  theme: BrandTheme; // computed palette (brand + resolved mode)
  mode: ThemeMode; // user-chosen mode
  locale: string;
  currency: string;
  setBrand: (brand: Brand) => void;
  setMode: (mode: ThemeMode) => void;
  setLocale: (locale: string) => void;
  setCurrency: (currency: string) => void;
};

const BrandContext = createContext<BrandContextType | undefined>(undefined);

const LS_BRAND_KEY = "entiznet-brand";
const LS_MODE_KEY = "entiznet-theme-mode";

function resolveMode(mode: ThemeMode): "light" | "dark" {
  if (mode !== "system") return mode;
  if (typeof window === "undefined") return "light"; // SSR fallback
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function BrandProvider({ children }: { children: React.ReactNode }) {
  // Initial brand
  const initialBrand = (() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem(LS_BRAND_KEY) as Brand | null;
      if (saved) return saved;
    }
    return getCurrentBrand() ?? ("entiznetstore" as Brand);
  })();

  // Initial mode
  const initialMode = (() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem(
        LS_MODE_KEY,
      ) as ThemeMode | null;
      if (saved === "light" || saved === "dark" || saved === "system")
        return saved;
    }
    return "system" as ThemeMode;
  })();

  const [brand, setBrandState] = useState<Brand>(initialBrand);
  const [mode, setModeState] = useState<ThemeMode>(initialMode);
  const [locale, setLocaleState] = useState("en");
  const [currency, setCurrencyState] = useState("USD");
  const resolved = resolveMode(mode);

  const config = useMemo(() => getBrandConfig(brand), [brand]);
  const theme = useMemo(
    () => getBrandTheme(brand, resolved),
    [brand, resolved],
  );

  const [mounted, setMounted] = useState(false);

  // Apply CSS vars + html[data-theme]
  useEffect(() => {
    applyBrandTheme(brand, resolved);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", resolved);
    }
  }, [brand, resolved]);

  // Persist
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LS_BRAND_KEY, brand);
    }
  }, [brand]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LS_MODE_KEY, mode);
    }
  }, [mode]);

  // React to system changes when in "system" mode
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (mode === "system") {
        const r = resolveMode("system");
        applyBrandTheme(brand, r);
        document.documentElement.setAttribute("data-theme", r);
      }
    };
    mq.addEventListener?.("change", handler);
    mq.addListener?.(handler); // Safari fallback
    return () => {
      mq.removeEventListener?.("change", handler);
      mq.removeListener?.(handler);
    };
  }, [brand, mode]);

  // Hydrate locale and currency from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedLocale = localStorage.getItem("locale") || "en";
    const savedCurrency = localStorage.getItem("currency") || "USD";
    setLocaleState(savedLocale);
    setCurrencyState(savedCurrency);

    const handleCurrencyChange = () => {
      const c = localStorage.getItem("currency") || "USD";
      setCurrencyState(c);
    };

    window.addEventListener("currencyChange", handleCurrencyChange);
    return () => window.removeEventListener("currencyChange", handleCurrencyChange);
  }, []);

  useEffect(() => setMounted(true), []);

  const setBrand = useCallback((b: Brand) => setBrandState(b), []);
  const setMode = useCallback((m: ThemeMode) => setModeState(m), []);
  const setLocale = useCallback((l: string) => setLocaleState(l), []);
  const setCurrency = useCallback((c: string) => setCurrencyState(c), []);

  const value = useMemo<BrandContextType>(
    () => ({ brand, config, theme, mode, locale, currency, setBrand, setMode, setLocale, setCurrency }),
    [brand, config, theme, mode, locale, currency, setBrand, setMode, setLocale, setCurrency],
  );

  if (!mounted) {
    // Avoid hydration flicker while CSS vars apply
    return <div style={{ visibility: "hidden" }}>{children}</div>;
  }

  return (
    <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
  );
}

/**
 * Defensive hook: if no BrandProvider is found above, return a safe default
 * and warn (so the app keeps running while we fix the stray import).
 */
export function useBrand(): BrandContextType {
  const ctx = useContext(BrandContext);
  if (ctx === undefined) {
    // The root application shell is dark by default. If a legacy consumer is
    // mounted outside this provider, its defensive theme must match that shell;
    // returning the old light fallback created light page surfaces with inherited
    // dark-shell foreground text and failed WCAG contrast on authenticated routes.
    const fallbackBrand = "entiznetstore" as Brand;
    const mode: ThemeMode = "dark";
    const resolved = "dark" as const;
    if (typeof window !== "undefined") {
      console.warn(
        "[useBrand] No BrandProvider found above this component. Using fallback theme. " +
          "Find and wrap this subtree with <BrandProvider>.",
      );
    }
    return {
      brand: fallbackBrand,
      config: getBrandConfig(fallbackBrand),
      theme: getBrandTheme(fallbackBrand, resolved),
      mode,
      locale: "en",
      currency: "USD",
      setBrand: () => {},
      setMode: () => {},
      setLocale: () => {},
      setCurrency: () => {},
    };
  }
  return ctx;
}
