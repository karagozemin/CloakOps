import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Enterprise dark surfaces
        ink: {
          950: "#070809",
          900: "#0b0d10",
          850: "#101317",
          800: "#15191f",
          700: "#1b2027",
          600: "#252b34",
        },
        // Muted gold accent
        gold: {
          DEFAULT: "#E8B923",
          soft: "#F2D272",
          dim: "#9c7c18",
        },
        cloak: {
          fg: "#E7E9EA",
          muted: "#8B9099",
          faint: "#5A616B",
          line: "#222831",
          ok: "#3FB68B",
          warn: "#E8B923",
          danger: "#E5564E",
          info: "#5B9BD5",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)",
        glow: "0 0 0 1px rgba(232,185,35,0.25), 0 8px 32px -8px rgba(232,185,35,0.18)",
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
