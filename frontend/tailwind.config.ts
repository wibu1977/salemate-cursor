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
        primary: {
          50: "#f0f7ff",
          100: "#e0effe",
          200: "#b9dffd",
          300: "#7cc4fc",
          400: "#36a6f8",
          500: "#0c8ce9",
          600: "#006fc7",
          700: "#0158a1",
          800: "#064b85",
          900: "#0b3f6e",
        },
        accent: {
          50: "#fef7ee",
          100: "#fdedd6",
          200: "#fad7ac",
          300: "#f6ba77",
          400: "#f19340",
          500: "#ee761b",
          600: "#df5c11",
          700: "#b94510",
          800: "#933715",
          900: "#772f14",
        },
      },
      fontFamily: {
        sans: ["Inter", "Pretendard", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
