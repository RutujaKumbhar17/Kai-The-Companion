/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        border: "hsl(var(--border))",
      },
      fontFamily: {
        heading: ["'Instrument Serif'", "serif"],
        body: ["'Barlow'", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
       animation: {
        "blur-text": "blurText 0.35s ease-out forwards",
      },
      keyframes: {
        blurText: {
          "0%": { filter: "blur(10px)", opacity: "0", transform: "translateY(50px)" },
          "50%": { filter: "blur(5px)", opacity: "0.5", transform: "translateY(-5px)" },
          "100%": { filter: "blur(0px)", opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
