import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        vc: {
          bg: "#030712",
          card: "#070b17",
          panel: "#0a0f1e",
          border: "#1f2937",
          "border-subtle": "rgba(255, 255, 255, 0.08)",
          gold: {
            DEFAULT: "#f5b800",
            hover: "#ffd34d",
            dark: "#b38600",
            bg: "#1a1300",
            border: "#d9a200",
          },
          emerald: "#34d399",
          rose: "#f43f5e",
          blue: "#3b82f6",
        },
      },
      fontFamily: {
        mono: [
          "var(--font-vc-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
        syne: ["var(--font-vc-syne)", "Syne", "sans-serif"],
        sans: [
          "var(--font-vc-sans)",
          "Space Grotesk",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
