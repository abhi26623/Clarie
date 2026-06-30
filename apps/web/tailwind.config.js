/** @type {import('tailwindcss').Config} */
export default {
  corePlugins: {
    preflight: false,
  },
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        "surface-raised": "var(--surface-raised)",
        "surface-overlay": "var(--surface-overlay)",
        ink: "var(--ink)",
        "ink-secondary": "var(--ink-secondary)",
        "ink-tertiary": "var(--ink-tertiary)",
        accent: "var(--accent)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      }
    },
  },
  plugins: [],
};
