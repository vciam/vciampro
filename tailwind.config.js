/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'gray-900': '#121212',
        'gray-800': '#1e1e1e',
        'gray-700': '#2d2d2d',
        'gray-600': '#4a4a4a',
        'gray-400': '#999999',
        'blue-500': '#3b82f6',
        'blue-600': '#2563eb',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
