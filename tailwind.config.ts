import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: "hsl(var(--bg))",
        fg: "hsl(var(--fg))",
        muted: "hsl(var(--muted))",
        card: "hsl(var(--card))",
        border: "hsl(var(--border))",
        primary: "hsl(var(--primary))",
        primaryFg: "hsl(var(--primary-fg))",
        danger: "hsl(var(--danger))",
        ring: "hsl(var(--ring))"
      },
      boxShadow: {
        soft: "0 8px 24px rgba(2, 6, 23, 0.08)",
        lift: "0 14px 45px rgba(2, 6, 23, 0.14)"
      },
      borderRadius: {
        xl: "0.9rem"
      }
    }
  },
  plugins: []
} satisfies Config;
