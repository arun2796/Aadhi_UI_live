/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#111238',
          dark: '#0a0b24',
          light: '#1d1e4e',
          card: '#161747',
          border: '#242668',
        },
        purple: {
          DEFAULT: '#4F2ACB',
          dark: '#3c1ea6',
          light: '#6a46e5',
          soft: '#ece8fd',
        },
        orange: {
          DEFAULT: '#FF7A00',
          hover: '#e66e00',
          light: '#ff9433',
          soft: '#fff2e5',
        },
        gold: {
          DEFAULT: '#FFB000',
          light: '#ffc83b',
          dark: '#d99500',
          soft: '#fff8e6',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 20px rgba(255, 122, 0, 0.35)',
        'glow-purple': '0 0 20px rgba(79, 42, 203, 0.35)',
        'card': '0 4px 20px -2px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 10px 30px -4px rgba(0, 0, 0, 0.12), 0 4px 10px -2px rgba(0, 0, 0, 0.06)',
      },
      animation: {
        'sparkle': 'sparkle 2s ease-in-out infinite',
        'pulse-subtle': 'pulseSubtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        sparkle: {
          '0%, 100%': { opacity: 0.3, transform: 'scale(0.95)' },
          '50%': { opacity: 1, transform: 'scale(1.05)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.85 },
        }
      }
    },
  },
  plugins: [],
}
