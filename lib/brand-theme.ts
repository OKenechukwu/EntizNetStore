// Brand-aware theme system for EntizNetStore dual brand architecture
"use client";

import { Brand, getBrandConfig } from './brand'

export interface BrandTheme {
  brand: Brand
  colors: {
    primary: string
    accent: string
    background: string
    surface: string
    text: {
      primary: string
      secondary: string
      accent: string
    }
    glass: {
      bg: string
      border: string
    }
    shadow: {
      soft: string
      luxury: string
      gold: string
    }
  }
  fonts: {
    primary: string
    serif: string
  }
}

export function getBrandTheme(brand: Brand, mode: 'light' | 'dark' = 'light'): BrandTheme {
  const config = getBrandConfig(brand)
  
  if (brand === 'primediscreet') {
    // PrimeDiscreet: Sophisticated dark/discrete theme
    return {
      brand,
      colors: {
        primary: config.colors.primary,     // #0A0A0A
        accent: config.colors.accent,       // #C9A876 (muted champagne)
        background: mode === 'light' ? '#1A1A1D' : '#0A0A0A',
        surface: mode === 'light' ? '#2A2A2D' : '#1A1A1D',
        text: {
          primary: mode === 'light' ? '#E5E5E5' : '#F5F5F5',
          secondary: mode === 'light' ? '#C5C5C5' : '#D5D5D5',
          accent: config.colors.accent,
        },
        glass: {
          bg: mode === 'light' ? 'rgba(42, 42, 45, 0.7)' : 'rgba(26, 26, 29, 0.8)',
          border: mode === 'light' ? 'rgba(229, 229, 229, 0.1)' : 'rgba(245, 245, 245, 0.05)',
        },
        shadow: {
          soft: '0 4px 32px rgba(0, 0, 0, 0.4)',
          luxury: '0 12px 40px rgba(201, 168, 118, 0.15)',
          gold: '0 8px 25px rgba(201, 168, 118, 0.3)',
        },
      },
      fonts: {
        primary: 'Inter, system-ui, sans-serif',
        serif: 'Cormorant Garamond, serif',
      },
    }
  }
  
  // EntizNetStore: Luxury gold & ivory theme (original)
  return {
    brand,
    colors: {
      primary: config.colors.primary,       // #0B0B0D
      accent: config.colors.accent,         // #D4AF37 (luxury gold)
      background: mode === 'light' ? config.colors.background : '#0B0B0D',
      surface: mode === 'light' ? '#FFFFFF' : '#1A1A1D',
      text: {
        primary: mode === 'light' ? '#0B0B0D' : '#F7F6F3',
        secondary: mode === 'light' ? '#1A1A1D' : '#E5E5E5',
        accent: config.colors.accent,
      },
      glass: {
        bg: mode === 'light' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 29, 0.7)',
        border: mode === 'light' ? 'rgba(11, 11, 13, 0.1)' : 'rgba(247, 246, 243, 0.1)',
      },
      shadow: {
        soft: mode === 'light' ? '0 4px 32px rgba(11, 11, 13, 0.1)' : '0 4px 32px rgba(0, 0, 0, 0.3)',
        luxury: '0 12px 40px rgba(212, 175, 55, 0.15)',
        gold: '0 8px 25px rgba(212, 175, 55, 0.4)',
      },
    },
    fonts: {
      primary: 'Inter, system-ui, sans-serif',
      serif: 'Cormorant Garamond, serif',
    },
  }
}

export function applyBrandTheme(brand: Brand, mode: 'light' | 'dark' = 'light') {
  const theme = getBrandTheme(brand, mode)
  
  if (typeof document !== 'undefined') {
    const root = document.documentElement
    
    // Apply brand-specific CSS variables
    root.style.setProperty('--brand-primary', theme.colors.primary)
    root.style.setProperty('--brand-accent', theme.colors.accent)
    root.style.setProperty('--brand-background', theme.colors.background)
    root.style.setProperty('--brand-surface', theme.colors.surface)
    root.style.setProperty('--brand-text-primary', theme.colors.text.primary)
    root.style.setProperty('--brand-text-secondary', theme.colors.text.secondary)
    root.style.setProperty('--brand-text-accent', theme.colors.text.accent)
    root.style.setProperty('--brand-glass-bg', theme.colors.glass.bg)
    root.style.setProperty('--brand-glass-border', theme.colors.glass.border)
    root.style.setProperty('--brand-shadow-soft', theme.colors.shadow.soft)
    root.style.setProperty('--brand-shadow-luxury', theme.colors.shadow.luxury)
    root.style.setProperty('--brand-shadow-gold', theme.colors.shadow.gold)
    
    // Set brand attribute for CSS selectors
    root.setAttribute('data-brand', brand)
  }
  
  return theme
}

export interface BrandClasses {
  background: string
  surface: string
  text: {
    primary: string
    secondary: string
    accent: string
  }
  button: {
    primary: string
    secondary: string
  }
  accent: string
}

export function getBrandClasses(brand: Brand): BrandClasses {
  if (brand === 'primediscreet') {
    return {
      background: 'bg-gradient-to-br from-zinc-900 to-black',
      surface: 'bg-zinc-800/50 backdrop-blur-sm',
      text: {
        primary: 'text-zinc-100',
        secondary: 'text-zinc-300',
        accent: 'text-amber-300',
      },
      button: {
        primary: 'bg-amber-300 text-zinc-900 hover:bg-amber-200',
        secondary: 'border border-amber-300 text-amber-300 hover:bg-amber-300 hover:text-zinc-900',
      },
      accent: 'border-amber-300',
    }
  }
  
  // EntizNetStore classes (original luxury theme)
  return {
    background: 'bg-contrast-ivory',
    surface: 'bg-white',
    text: {
      primary: 'text-primary-black',
      secondary: 'text-charcoal',
      accent: 'text-accent-gold',
    },
    button: {
      primary: 'bg-accent-gold text-primary-black hover:bg-accent-gold/90',
      secondary: 'border border-accent-gold text-accent-gold hover:bg-accent-gold hover:text-primary-black',
    },
    accent: 'border-accent-gold',
  }
}