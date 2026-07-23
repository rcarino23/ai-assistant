import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        "surface-raised": "var(--surface-raised)",
        border: "var(--border)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        "accent-ink": "var(--accent-ink)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(20, 20, 20, 0.04), 0 8px 24px -12px rgba(20, 20, 20, 0.10)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "modal-in": {
          "0%": { opacity: "0", transform: "scale(0.96) translateY(6px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "toast-in": {
          "0%": { opacity: "0", transform: "translate(-50%, 8px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translate(-50%, 0) scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        blink: "blink 1s step-start infinite",
        "modal-in": "modal-in 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
        "toast-in": "toast-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;