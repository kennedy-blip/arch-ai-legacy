/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        archaeo: {
          bg: "#080c14",
          surface: "#0e1524",
          card: "#141e33",
          border: "#1f2e4d",
          muted: "#7e8da6",
          gold: "#f59e0b",
          goldMuted: "rgba(245, 158, 11, 0.15)",
          cyan: "#06b6d4",
          cyanMuted: "rgba(6, 182, 212, 0.15)",
          danger: "#f43f5e",
          dangerMuted: "rgba(244, 63, 94, 0.15)",
          emerald: "#10b981",
          emeraldMuted: "rgba(16, 185, 129, 0.15)",
          purple: "#a855f7",
          purpleMuted: "rgba(168, 85, 247, 0.15)",
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(245, 158, 11, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(245, 158, 11, 0.6)' },
        }
      }
    },
  },
  plugins: [],
};
