import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17211b",
        rosey: "#b84a5a",
        moss: "#456f5a",
        paper: "#fbfaf7",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      boxShadow: {
        panel: "0 20px 50px rgba(23, 33, 27, 0.12)",
      },
    },
  },
  plugins: [],
} satisfies Config;
