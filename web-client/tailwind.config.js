import animate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['"Hanken Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        sm: '0.125rem',
        DEFAULT: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
      spacing: {
        'gutter': '1rem',
        'gutter-dense': '0.5rem',
        'margin': '1.5rem',
        'margin-mobile': '1rem',
        'space-xs': '0.25rem',
        'space-sm': '0.5rem',
        'space-md': '0.75rem',
        'space-lg': '1.25rem',
        'space-xl': '1.75rem',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        },
        // Dashboard entrance: cards lift into place rather than snapping in.
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        // Slow shimmer behind the hero band, so a static page still feels live.
        'drift': {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(0,-6px,0) scale(1.04)' }
        },
        // Pulsing ring on the "live" indicator.
        'ping-soft': {
          '0%': { transform: 'scale(1)', opacity: '0.7' },
          '75%, 100%': { transform: 'scale(2.2)', opacity: '0' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'rise-in': 'rise-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'drift': 'drift 9s ease-in-out infinite',
        'ping-soft': 'ping-soft 2s cubic-bezier(0, 0, 0.2, 1) infinite'
      }
    }
  },
  plugins: [
    animate,
    function ({ addUtilities }) {
      addUtilities({
        '.text-display-lg': {
          fontFamily: '"Hanken Grotesk", sans-serif',
          fontSize: '32px',
          fontWeight: '700',
          lineHeight: '40px',
          letterSpacing: '-0.02em',
        },
        '.text-display-lg-mobile': {
          fontFamily: '"Hanken Grotesk", sans-serif',
          fontSize: '26px',
          fontWeight: '700',
          lineHeight: '34px',
          letterSpacing: '-0.015em',
        },
        '.text-headline-lg': {
          fontFamily: '"Hanken Grotesk", sans-serif',
          fontSize: '24px',
          fontWeight: '600',
          lineHeight: '32px',
          letterSpacing: '-0.015em',
        },
        '.text-headline-md': {
          fontFamily: '"Hanken Grotesk", sans-serif',
          fontSize: '20px',
          fontWeight: '600',
          lineHeight: '28px',
          letterSpacing: '-0.01em',
        },
        '.text-headline-sm': {
          fontFamily: '"Hanken Grotesk", sans-serif',
          fontSize: '16px',
          fontWeight: '600',
          lineHeight: '24px',
          letterSpacing: '-0.005em',
        },
        '.text-body-lg': {
          fontFamily: 'Inter, sans-serif',
          fontSize: '15px',
          fontWeight: '400',
          lineHeight: '22px',
        },
        '.text-body-md': {
          fontFamily: 'Inter, sans-serif',
          fontSize: '13px',
          fontWeight: '400',
          lineHeight: '18px',
        },
        '.text-body-sm': {
          fontFamily: 'Inter, sans-serif',
          fontSize: '12px',
          fontWeight: '400',
          lineHeight: '16px',
        },
        '.text-telemetry-lg': {
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '20px',
          fontWeight: '600',
          lineHeight: '24px',
          letterSpacing: '-0.02em',
        },
        '.text-telemetry-md': {
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '13px',
          fontWeight: '500',
          lineHeight: '18px',
          letterSpacing: '-0.01em',
        },
        '.text-label-md': {
          fontFamily: 'Inter, sans-serif',
          fontSize: '12px',
          fontWeight: '500',
          lineHeight: '16px',
        },
        '.text-label-sm': {
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '11px',
          fontWeight: '500',
          lineHeight: '14px',
          letterSpacing: '0.02em',
        }
      })
    }
  ],
}
