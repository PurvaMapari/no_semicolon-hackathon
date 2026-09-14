export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "Arial", "sans-serif"] },
      colors: {
        muted: {
          DEFAULT: "var(--muted-bg, #1e293b)",
          foreground: "var(--muted-fg, #94a3b8)",
        },
      },
    },
  },
  plugins: [],
};
