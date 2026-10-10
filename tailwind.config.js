/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#FAF9F6',
        ink: '#242620',
        accent: '#356B50',
        'accent-light': '#4A8C6B',
        'accent-dark': '#28543E',
        surface: '#FFFFFF',
        muted: '#6B6D65',
        border: '#E8E6E0',
        'border-light': '#F0EEE8',
        score: {
          excellent: '#356B50',
          good: '#5B8A72',
          fair: '#B48A3E',
          poor: '#A8554A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif Pro"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(36, 38, 32, 0.04), 0 1px 3px rgba(36, 38, 32, 0.03)',
        'card-hover': '0 4px 12px rgba(36, 38, 32, 0.06), 0 2px 4px rgba(36, 38, 32, 0.04)',
        popover: '0 8px 24px rgba(36, 38, 32, 0.08), 0 2px 6px rgba(36, 38, 32, 0.04)',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '112': '28rem',
        '128': '32rem',
      },
      letterSpacing: {
        tightest: '-0.03em',
      },
    },
  },
  plugins: [],
};
