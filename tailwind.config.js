/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Schedlytics brand palette - dark navy base, cyan accent
        navy: {
          950: '#0B1120', // deepest background
          900: '#0F172A', // main canvas
          850: '#121C30',
          800: '#1E293B', // panels / cards (≈ #1E2937)
          750: '#243245',
          700: '#334155', // borders / hover
        },
        cyan: {
          accent: '#22D3EE',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        panel: '0 10px 40px -12px rgba(0, 0, 0, 0.55)',
        glow: '0 0 24px -4px rgba(34, 211, 238, 0.55)',
        // ~20% softer than `glow`, so the Create Post button no longer
        // out-shines the Growth Level hero.
        'glow-soft': '0 0 18px -6px rgba(34, 211, 238, 0.42)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(24px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-in-up': {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'slide-in-left': 'slide-in-left 0.25s ease-out',
        'slide-in-up': 'slide-in-up 0.4s ease-out both',
      },
    },
  },
  plugins: [],
}
