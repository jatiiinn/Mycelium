import type { Config } from "tailwindcss";

// Light editorial palette matched to the user's homepage reference:
// white canvas, near-black text, hairline rules, monochrome chrome.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Inter",
          "Helvetica Neue", "Arial", "sans-serif",
        ],
      },
      colors: {
        paper: "#ffffff",  // page + cards
        ink: "#111111",    // primary text
        dim: "#8a8a8a",    // secondary text
        line: "#e6e6e6",   // hairline borders
        faint: "#f4f4f4",  // hover fills / shimmer base
        ember: "#b23a2f",  // errors / failed state
      },
    },
  },
  plugins: [],
};
export default config;
