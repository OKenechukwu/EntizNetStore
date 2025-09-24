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
        // Brand colors for luxury adult wellness theme
        brandPink: {
          50: '#FDF2F8',
          100: '#FCE7F3',
          200: '#FBCFE8',
          300: '#F9A8D4',
          400: '#F472B6',
          500: '#EC4899', // Main brand pink
          600: '#DB2777',
          700: '#BE185D',
          800: '#9D174D',
          900: '#831843',
          DEFAULT: '#EC4899',
        },
        brandPurple: {
          50: '#FAF5FF',
          100: '#F3E8FF',
          200: '#E9D5FF',
          300: '#D8B4FE',
          400: '#C084FC',
          500: '#A855F7', // Main brand purple
          600: '#9333EA',
          700: '#7C3AED',
          800: '#6B21A8',
          900: '#581C87',
          DEFAULT: '#A855F7',
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
