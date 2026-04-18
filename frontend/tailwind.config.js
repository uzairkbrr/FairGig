/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#eefaf3',
          100: '#d4f3e0',
          500: '#0fa968',
          600: '#0a8f58',
          700: '#067046',
        },
      },
    },
  },
  plugins: [],
};
