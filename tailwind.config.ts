import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./types/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sage: "var(--sage)",
        "sage-light": "var(--sage-light)",
        cream: "var(--cream)",
        dark: "var(--dark)",
        mid: "var(--mid)",
        accent: "var(--accent)",
      },
      borderRadius: {
        card: "20px",
        pill: "100px",
      },
      boxShadow: {
        card: "0 4px 40px rgba(30, 38, 32, 0.08)",
        "card-hover": "0 12px 40px rgba(30, 38, 32, 0.12)",
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "sans-serif"],
        display: ["var(--font-playfair-display)", "serif"],
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        grow: {
          to: { width: "var(--target-width)" },
        },
        reveal: {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        float: "float 4s ease-in-out infinite",
      },
      maxWidth: {
        marketing: "1100px",
      },
    },
  },
  plugins: [],
};

export default config;
