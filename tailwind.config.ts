import type { Config } from "tailwindcss";

/**
 * Degis Tickets design tokens.
 * Matte black foundation · crimson as the signal color · dark gold reserved for VIP.
 * No bright colors. No cheap gradients. Everything should feel expensive.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0B0B0D", // page background — matte black, slightly warm
          900: "#121215", // raised surfaces
          800: "#1A1A1F", // cards
          700: "#26262D", // borders, dividers
          500: "#55555F",
          300: "#9C9CA6", // secondary text
          100: "#E8E8EC", // primary text
        },
        crimson: {
          DEFAULT: "#8E1F2F", // luxury crimson — deep, not bright
          hover: "#A3283A",
          muted: "#3A171D",
        },
        gold: {
          DEFAULT: "#B08D4C", // dark gold — VIP surfaces only
          soft: "#8C7140",
          faint: "#2A2418",
        },
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
        ethiopic: ["var(--font-ethiopic)", "serif"],
      },
      borderRadius: {
        card: "1.25rem",
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 40px -24px rgba(0,0,0,0.8)",
        vip: "0 1px 0 0 rgba(176,141,76,0.25) inset, 0 20px 40px -24px rgba(0,0,0,0.8)",
      },
      letterSpacing: {
        luxe: "0.18em",
      },
    },
  },
  plugins: [],
};
export default config;
