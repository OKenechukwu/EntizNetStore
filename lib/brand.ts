// lib/brand.ts
"use client";

export type Brand = "entiznetstore" | "primediscreet";

export interface BrandConfig {
  name: string;
  tagline: string;
  description: string;
  domain: string;
  colors: {
    primary: string;
    accent: string;
    background: string;
  };
  logo: string;
  favicon: string;
}

export const BRAND_CONFIGS: Record<Brand, BrandConfig> = {
  entiznetstore: {
    name: "EntizNet Store",
    tagline: "Luxury Adult Marketplace",
    description: "Premium adult products and experiences. Discrete, luxury, authentic.",
    domain: "entiznetstore.com",
    colors: {
      primary: "#0B0B0D",      // Deep black
      accent: "#D4AF37",       // Luxury gold
      background: "#F7F6F3",   // Warm ivory
    },
    logo: "/logos/entiznet-logo.svg",
    favicon: "/favicons/entiznet.ico",
  },
  primediscreet: {
    name: "Prime Discreet",
    tagline: "Elite Intimate Collection", 
    description: "Ultra-premium intimate products for discerning adults. Exclusively curated.",
    domain: "primediscreet.com",
    colors: {
      primary: "#0A0A0A",      // Deeper black for more discrete feel
      accent: "#C9A876",       // Muted champagne gold
      background: "#1A1A1D",   // Dark charcoal for sophisticated discrete theme
    },
    logo: "/logos/primediscreet-logo.svg",
    favicon: "/favicons/primediscreet.ico",
  },
};

export function getBrandFromDomain(domain: string): Brand {
  if (domain.includes("primediscreet")) {
    return "primediscreet";
  }
  return "entiznetstore"; // Default
}

export function getBrandFromEnv(): Brand {
  const envBrand = process.env.NEXT_PUBLIC_SITE_BRAND as Brand;
  return envBrand && envBrand in BRAND_CONFIGS ? envBrand : "entiznetstore";
}

export function getCurrentBrand(): Brand {
  // Try environment variable first
  const envBrand = getBrandFromEnv();
  
  // If in browser, check domain
  if (typeof window !== "undefined") {
    const domainBrand = getBrandFromDomain(window.location.hostname);
    return domainBrand;
  }
  
  return envBrand;
}

export function getBrandConfig(brand?: Brand): BrandConfig {
  const currentBrand = brand || getCurrentBrand();
  return BRAND_CONFIGS[currentBrand];
}

export function getBrandMetadata(brand?: Brand) {
  const config = getBrandConfig(brand);
  return {
    title: `${config.name} - ${config.tagline}`,
    description: config.description,
    keywords: `adult marketplace, luxury products, discrete shopping, ${config.name.toLowerCase()}`,
    robots: "noindex, nofollow", // Adult content
  };
}