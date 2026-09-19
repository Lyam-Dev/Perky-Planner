/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      /**
       * Every colour is driven by a CSS custom property defined in
       * `src/renderer/index.css`, so switching the theme or accent in Settings
       * re-skins the whole app instantly without re-rendering components.
       * Values are stored as space-separated RGB channels so Tailwind's
       * `<alpha-value>` (e.g. `bg-surface/70`) keeps working.
       */
      colors: {
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          muted: 'rgb(var(--surface-muted) / <alpha-value>)',
          border: 'rgb(var(--surface-border) / <alpha-value>)'
        },
        /** Foreground text ramp, darkest → faintest. */
        content: {
          DEFAULT: 'rgb(var(--content) / <alpha-value>)',
          muted: 'rgb(var(--content-muted) / <alpha-value>)',
          subtle: 'rgb(var(--content-subtle) / <alpha-value>)',
          faint: 'rgb(var(--content-faint) / <alpha-value>)'
        },
        /** Accent ramp, remapped per selected accent colour. */
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)'
        }
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif'
        ]
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        /* Bouncy entrance used for the event modal. */
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.88) translateY(10px)' },
          '60%': { opacity: '1', transform: 'scale(1.02) translateY(-2px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' }
        },
        /* Generic rise-in used for list items. */
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        /* Sidebar / panels entering from the right. */
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' }
        },
        /* Staggered day-cell entrance on month changes. */
        'cell-in': {
          '0%': { opacity: '0', transform: 'translateY(6px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' }
        },
        /* Event chips sliding in inside a day cell. */
        'chip-in': {
          '0%': { opacity: '0', transform: 'translateX(-6px) scale(0.92)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1)' }
        },
        /* Checkbox tick bounce. */
        'check-pop': {
          '0%': { transform: 'scale(0.4)' },
          '55%': { transform: 'scale(1.35)' },
          '100%': { transform: 'scale(1)' }
        },
        /* Day-view timeline blocks growing out from their start time. */
        'grow-block': {
          '0%': { opacity: '0', transform: 'scaleX(0.03)' },
          '100%': { opacity: '1', transform: 'scaleX(1)' }
        },
        /* Gentle idle float for the logo. */
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-2.5px)' }
        },
        /* Soft breathing pulse (e.g. "now" indicator). */
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' }
        },
        /* Playful wiggle on hover for buttons/logos. */
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-7deg)' },
          '75%': { transform: 'rotate(7deg)' }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.15s ease-out',
        'scale-in': 'scale-in 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        'pop-in': 'pop-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'slide-up': 'slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-right': 'slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
        'cell-in': 'cell-in 0.32s cubic-bezier(0.16, 1, 0.3, 1) both',
        'chip-in': 'chip-in 0.24s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'check-pop': 'check-pop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'grow-block': 'grow-block 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        float: 'float 2.4s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite',
        wiggle: 'wiggle 0.4s ease-in-out'
      }
    }
  },
  plugins: []
}
