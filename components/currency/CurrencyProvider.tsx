// components/currency/CurrencyProvider.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import {
  SupportedCurrency,
  DEFAULT_CURRENCY,
  getFxRates,
  BASE_CURRENCY,
} from "@/lib/currency";

type CurrencyContextType = {
  currency: SupportedCurrency;
  setCurrency: (currency: SupportedCurrency) => void;
  rates: Record<string, number>;
  refreshRates: () => Promise<void>;
  isLoading: boolean;
};

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within CurrencyProvider");
  }
  return context;
}

interface CurrencyProviderProps {
  children: React.ReactNode;
  initialCurrency?: SupportedCurrency;
}

const COOKIE_NAME = "entiz_currency";
const RATES_CACHE_KEY = "entiz_fx_rates";
const RATES_TIMESTAMP_KEY = "entiz_fx_timestamp";
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000; // 12 hours

/**
 * CurrencyProvider with SSR cookie support and 12h FX rate caching
 */
export function CurrencyProvider({
  children,
  initialCurrency = DEFAULT_CURRENCY,
}: CurrencyProviderProps) {
  const [currency, setCurrencyState] = useState<SupportedCurrency>(initialCurrency);
  const [rates, setRates] = useState<Record<string, number>>({ [BASE_CURRENCY]: 1 });
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Hydrate on mount
  useEffect(() => {
    setMounted(true);
    
    if (typeof window === "undefined") return;

    // Load currency from cookie or localStorage
    const cookieMatch = document.cookie.match(new RegExp(`(^| )${COOKIE_NAME}=([^;]+)`));
    const savedCurrency = cookieMatch?.[2] || localStorage.getItem(COOKIE_NAME) || initialCurrency;
    
    if (savedCurrency !== currency) {
      setCurrencyState(savedCurrency as SupportedCurrency);
    }

    // Load cached rates if fresh (< 12h old)
    const cachedRates = localStorage.getItem(RATES_CACHE_KEY);
    const timestamp = localStorage.getItem(RATES_TIMESTAMP_KEY);
    
    if (cachedRates && timestamp) {
      const age = Date.now() - parseInt(timestamp, 10);
      if (age < TWELVE_HOURS_MS) {
        try {
          setRates(JSON.parse(cachedRates));
          return; // Use cached rates, don't fetch
        } catch {}
      }
    }

    // Fetch fresh rates
    loadRates();
  }, []);

  const loadRates = useCallback(async () => {
    setIsLoading(true);
    try {
      const freshRates = await getFxRates(BASE_CURRENCY, TWELVE_HOURS_MS);
      setRates(freshRates);
      
      // Cache rates in localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem(RATES_CACHE_KEY, JSON.stringify(freshRates));
        localStorage.setItem(RATES_TIMESTAMP_KEY, Date.now().toString());
      }
    } catch (error) {
      console.error("Failed to load FX rates:", error);
      // Keep existing rates or use fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setCurrency = useCallback((newCurrency: SupportedCurrency) => {
    setCurrencyState(newCurrency);
    
    // Persist to cookie and localStorage
    if (typeof window !== "undefined") {
      // Set cookie with 1 year expiry
      document.cookie = `${COOKIE_NAME}=${newCurrency}; path=/; max-age=${60 * 60 * 24 * 365}`;
      localStorage.setItem(COOKIE_NAME, newCurrency);
      
      // Dispatch event for cross-component updates
      window.dispatchEvent(new CustomEvent("currencyChange", { detail: newCurrency }));
    }
  }, []);

  const refreshRates = useCallback(async () => {
    // Clear cache to force fresh fetch
    if (typeof window !== "undefined") {
      localStorage.removeItem(RATES_CACHE_KEY);
      localStorage.removeItem(RATES_TIMESTAMP_KEY);
    }
    await loadRates();
  }, [loadRates]);

  const value = useMemo(
    () => ({
      currency,
      setCurrency,
      rates,
      refreshRates,
      isLoading,
    }),
    [currency, setCurrency, rates, refreshRates, isLoading]
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}
