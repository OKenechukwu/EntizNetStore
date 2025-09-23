"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Brand, BrandConfig, getCurrentBrand, getBrandConfig } from "@/lib/brand";

type BrandContextType = {
  brand: Brand;
  config: BrandConfig;
  setBrand: (brand: Brand) => void;
};

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrandState] = useState<Brand>("entiznetstore");
  const [config, setConfig] = useState<BrandConfig>(getBrandConfig("entiznetstore"));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const currentBrand = getCurrentBrand();
    setBrandState(currentBrand);
    setConfig(getBrandConfig(currentBrand));
    setMounted(true);
  }, []);

  const setBrand = (newBrand: Brand) => {
    setBrandState(newBrand);
    setConfig(getBrandConfig(newBrand));
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return <div style={{ visibility: "hidden" }}>{children}</div>;
  }

  return (
    <BrandContext.Provider value={{ brand, config, setBrand }}>
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