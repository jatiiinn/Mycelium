import type { Config } from "tailwindcss";

// Provisional dark palette — the user's UI reference images are the source
// of truth for the final look; adjust these tokens when those arrive.
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
        ink: "#0e0f0d",       // page background (near-black, faint green cast)
        surface: "#151713",   // cards, header
        raised: "#1c1f19",    // hover / inputs
        seam: "#262a22",      // borders
        fog: "#e7eae1",       // primary text
        moss: "#8b937f",      // muted text
        lichen: "#c6d2ab",    // accent (tags, focus, links)
        ember: "#d99a8a",     // errors / failed state
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
};
export default config;
