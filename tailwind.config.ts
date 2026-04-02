import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        success: {
          DEFAULT: 'var(--success)',
          foreground: 'var(--success-foreground)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          foreground: 'var(--warning-foreground)',
        },
        info: {
          DEFAULT: 'var(--info)',
          foreground: 'var(--info-foreground)',
        },
        sidebar: {
          DEFAULT: 'var(--sidebar-background)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },
        phase: {
          pendiente: 'var(--phase-pendiente)',
          desarrollo: 'var(--phase-desarrollo)',
          testing: 'var(--phase-testing)',
          produccion: 'var(--phase-produccion)',
          descubrimiento: 'var(--phase-descubrimiento)',
          planificacion: 'var(--phase-planificacion)',
          'en-aprobacion': 'var(--phase-en-aprobacion)',
        },
        chart: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
          4: 'var(--chart-4)',
          5: 'var(--chart-5)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'count-up': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
        'fade-in': 'fade-in 0.4s ease-out',
        'count-up': 'count-up 0.5s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
