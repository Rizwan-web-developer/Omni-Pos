import type { Config } from "tailwindcss";

/**
 * OmniPos Hub design tokens.
 *
 * The palette is driven by CSS variables (see app/globals.css) so the same
 * utilities work across themes:
 *   light (default) → Stitch White & Orange · #F8FAFC / #FFFFFF / #EA580C
 *   dark            → neutral near-black      · #080808 / #111111 / #F97316
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--background) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        "surface-3": "rgb(var(--surface-3) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        "line-strong": "rgb(var(--line-strong) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          hover: "rgb(var(--accent-hover) / <alpha-value>)",
          fg: "rgb(var(--accent-fg) / <alpha-value>)",
          soft: "rgb(var(--accent-soft) / <alpha-value>)",
          line: "rgb(var(--accent-line) / <alpha-value>)",
        },
        brand: "rgb(var(--brand) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
        overlay: "rgb(var(--overlay) / <alpha-value>)",
      },
      fontFamily: {
        sans: [
          "Geist",
          "Segoe UI Variable Text",
          "Segoe UI",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "Geist Mono",
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        panel: "0 24px 64px -24px rgb(var(--shadow-color) / 0.35), 0 2px 8px -4px rgb(var(--shadow-color) / 0.18)",
        float: "0 8px 24px -12px rgb(var(--shadow-color) / 0.28), 0 1px 2px rgb(var(--shadow-color) / 0.08)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "translateY(6px) scale(0.99)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 140ms ease-out both",
        "scale-in": "scale-in 160ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-in-right": "slide-in-right 200ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-in-left": "slide-in-left 200ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-up": "slide-up 200ms cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
