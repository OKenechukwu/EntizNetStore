import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ===== COLORS ============================================================
      colors: {
        // ---- Royal Desire (Option A) ----
        brand: {
          primary: "var(--brand-primary, #7A00D1)",     // Royal Purple
          secondary: "var(--brand-secondary, #D1B000)", // Luxury Gold
        },

        // Semantic colors (Royal Desire Option A)
        background: "var(--background, #0B0A0D)",
        foreground: "var(--foreground, #F4F3F6)",
        border: "var(--border, rgba(255,255,255,0.12))",
        muted: "var(--muted, #1A1720)",
        card: "var(--card, #121017)",

        // ---- Legacy/compat palettes (kept so existing components won’t break) ----
        primary: {
          black: "#0B0B0D",
          DEFAULT: "#0B0B0D",
        },
        accent: {
          gold: "#D1B000", // align gold with brand.secondary
          DEFAULT: "#D1B000",
        },
        contrast: {
          ivory: "#F7F6F3",
          charcoal: "#1A1A1D",
        },

        // Retained scales (not used by new UI, safe for old components)
        brandPink: {
          50: "#FDF2F8",
          100: "#FCE7F3",
          200: "#FBCFE8",
          300: "#F9A8D4",
          400: "#F472B6",
          500: "#EC4899",
          600: "#DB2777",
          700: "#BE185D",
          800: "#9D174D",
          900: "#831843",
          DEFAULT: "#EC4899",
        },
        brandPurple: {
          50: "#FAF5FF",
          100: "#F3E8FF",
          200: "#E9D5FF",
          300: "#D8B4FE",
          400: "#C084FC",
          500: "#A855F7",
          600: "#9333EA",
          700: "#7C3AED",
          800: "#6B21A8",
          900: "#581C87",
          DEFAULT: "#A855F7",
        },
      },

      // ===== TYPOGRAPHY =======================================================
      fontFamily: {
        // Use Poppins globally (luxury-modern), keep serif for headings if needed
        sans: ["Poppins", "Inter", "system-ui", "sans-serif"],
        serif: ["Cormorant Garamond", "serif"],
      },

      // ===== SPACING ==========================================================
      spacing: {
        "18": "4.5rem",
        "88": "22rem",
      },

      // ===== EFFECTS ==========================================================
      animation: {
        shimmer: "shimmer 2s infinite",
        "fade-in": "fadeIn 0.5s ease-in-out",
        "slide-up": "slideUp 0.4s ease-out",
      },

      backdropBlur: {
        xs: "2px",
      },

      boxShadow: {
        luxury: "0 4px 32px rgba(11, 11, 13, 0.1)",
        "luxury-hover": "0 12px 40px rgba(209, 176, 0, 0.15)", // slight gold hue
        gold: "0 8px 25px rgba(209, 176, 0, 0.4)",
        // Royal Desire glow for accents/buttons
        glow: "0 0 10px rgba(209,176,0,0.4)",
      },

      backgroundImage: {
        "brand-grad":
          "linear-gradient(135deg, var(--brand-primary, #5B0060), var(--brand-secondary, #D1B000))",
      },

      borderRadius: {
        xl2: "14px",
      },
    },
  },
  plugins: [],
};

export default config;
