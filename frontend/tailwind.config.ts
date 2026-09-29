import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#EEF2FF",
          100: "#E0E7FF",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
        },
      },
      boxShadow: {
        glass: "0 8px 32px rgba(31, 38, 135, 0.10)",
        "glass-hover": "0 12px 40px rgba(31, 38, 135, 0.15)",
        "glass-inner": "inset 0 1px 0 rgba(255, 255, 255, 0.8)",
      },
      backdropBlur: {
        glass: "20px",
      },
      animation: {
        "float-slow": "float 14s ease-in-out infinite",
        "float-reverse": "floatReverse 16s ease-in-out infinite",
        "pulse-subtle": "pulseSubtle 6s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translate(0px, 0px) scale(1)" },
          "50%": { transform: "translate(30px, -25px) scale(1.08)" },
        },
        floatReverse: {
          "0%, 100%": { transform: "translate(0px, 0px) scale(1)" },
          "50%": { transform: "translate(-25px, 35px) scale(0.92)" },
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "0.28" },
          "50%": { opacity: "0.42" },
        },
      },
    },
  },
  plugins: [],
};

export default config;

# Commit ref: 6
