/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: "#0d0e12",
          card: "rgba(20, 22, 30, 0.7)",
          border: "rgba(255, 255, 255, 0.08)",
          cyan: "#00f0ff",
          red: "#ff0055",
          orange: "#ff5e00",
          yellow: "#ffaa00",
          green: "#39ff14",
          text: "#e2e8f0",
          muted: "#94a3b8"
        }
      },
      fontFamily: {
        orbitron: ["Orbitron", "sans-serif"],
        rajdhani: ["Rajdhani", "sans-serif"],
        inter: ["Inter", "sans-serif"]
      },
      boxShadow: {
        'cyan-glow': '0 0 15px rgba(0, 240, 255, 0.3)',
        'red-glow': '0 0 15px rgba(255, 0, 85, 0.3)',
        'yellow-glow': '0 0 15px rgba(255, 170, 0, 0.3)',
        'orange-glow': '0 0 15px rgba(255, 94, 0, 0.3)',
        'green-glow': '0 0 15px rgba(57, 255, 20, 0.3)'
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
