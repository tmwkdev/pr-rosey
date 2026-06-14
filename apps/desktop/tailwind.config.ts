import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#f4f4f2",
        muted: "#a7aaa4",
        faint: "#696d66",
        rosey: "#e65f73",
        moss: "#6bd19b",
        paper: "#0d0f0d",
        panel: "#151713",
        line: "#2a2e27",
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
        panel: "0 20px 70px rgba(0, 0, 0, 0.38)",
      },
    },
  },
  plugins: [],
} satisfies Config;
