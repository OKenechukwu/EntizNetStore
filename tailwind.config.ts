import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // EntizNetStore Luxury Palette
        primary: {
          black: '#0B0B0D',
          DEFAULT: '#0B0B0D',
        },
        accent: {
          gold: '#D4AF37',
          DEFAULT: '#D4AF37',
        },
        contrast: {
          ivory: '#F7F6F3',
          charcoal: '#1A1A1D',
        },
        // Semantic colors
        background: 'var(--background-primary)',
        foreground: 'var(--text-primary)',
        border: 'var(--border-subtle)',
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      animation: {
        'shimmer': 'shimmer 2s infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'luxury': '0 4px 32px rgba(11, 11, 13, 0.1)',
        'luxury-hover': '0 12px 40px rgba(212, 175, 55, 0.15)',
        'gold': '0 8px 25px rgba(212, 175, 55, 0.4)',
      },
    },
  },
  plugins: [],
  darkMode: ['class', '[data-theme="dark"]'],
};
export default config;
