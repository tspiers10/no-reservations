import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      keyframes: {
        "slide-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
      },
      animation: {
        "slide-up": "slide-up 250ms ease-out",
      },
      colors: {
        // Walk-in status pin colors
        "pin-walkin": "#22c55e",      // green-500
        "pin-bar": "#eab308",         // yellow-500
        "pin-parties": "#f97316",     // orange-500
        "pin-reserved": "#9ca3af",    // gray-400
      },
    },
  },
  plugins: [],
};

export default config;
