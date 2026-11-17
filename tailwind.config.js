/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B0E13",
        surface: "#12161D",
        surface2: "#161B24",
        line: "#232A35",
        brand: "#1E6FFF",
        brandDim: "#123A73",
        sonar: "#4FE0FF",
        warn: "#FFB020",
        ok: "#00B368",
        text: "#F4F7FB",
        muted: "#8A96A5",
      },
      fontFamily: {
        display: ["Oswald", "Arial Narrow", "sans-serif"],
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
