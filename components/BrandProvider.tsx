"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Brand, BrandConfig, getCurrentBrand, getBrandConfig } from "@/lib/brand";
import { applyBrandTheme, getBrandTheme, BrandTheme } from "@/lib/brand-theme";

type BrandContextType = {
  brand: Brand;
  config: BrandConfig;
  theme: BrandTheme;
  setBrand: (brand: Brand) => void;
};

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrandState] = useState<Brand>("entiznetstore");
  const [config, setConfig] = useState<BrandConfig>(getBrandConfig("entiznetstore"));
  const [theme, setTheme] = useState<BrandTheme>(getBrandTheme("entiznetstore"));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const currentBrand = getCurrentBrand();
    const currentMode = 'light'; // Default to light, will be enhanced later
    setBrandState(currentBrand);
    setConfig(getBrandConfig(currentBrand));
    setTheme(getBrandTheme(currentBrand, currentMode));
    applyBrandTheme(currentBrand, currentMode);
    setMounted(true);
  }, []);

  const setBrand = (newBrand: Brand) => {
    const currentMode = 'light'; // Default to light for now
    setBrandState(newBrand);
    setConfig(getBrandConfig(newBrand));
    const newTheme = getBrandTheme(newBrand, currentMode);
    setTheme(newTheme);
    applyBrandTheme(newBrand, currentMode);
    
    // Store brand preference in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('entiznet-brand', newBrand);
    }
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return <div style={{ visibility: "hidden" }}>{children}</div>;
  }

  return (
    <BrandContext.Provider value={{ brand, config, theme, setBrand }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const context = useContext(BrandContext);
  if (context === undefined) {
    throw new Error("useBrand must be used within a BrandProvider");
  }
  return context;
}