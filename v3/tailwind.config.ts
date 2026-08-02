import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

// Paleta/tipografia portadas 1:1 de docs/css/style.css (V2) — ver
// src/styles/globals.css para os valores reais das CSS variables.
// Convenção shadcn/ui (background/foreground/primary/muted/...) mapeada
// para os nomes já usados na V2 sempre que possível, para minimizar
// tradução mental entre as duas bases.
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--bg)',
        foreground: 'var(--text)',
        border: 'var(--border)',
        border2: 'var(--border2)',
        input: 'var(--border)',
        ring: 'var(--accent)',
        surface: 'var(--surface)',
        surface2: 'var(--surface2)',
        surface3: 'var(--surface3)',
        card: {
          DEFAULT: 'var(--surface)',
          foreground: 'var(--text)',
        },
        popover: {
          DEFAULT: 'var(--surface)',
          foreground: 'var(--text)',
        },
        primary: {
          DEFAULT: 'var(--accent)',
          light: 'var(--accent-light)',
          text: 'var(--accent-text)',
          foreground: '#ffffff',
        },
        muted: {
          DEFAULT: 'var(--surface2)',
          foreground: 'var(--text2)',
        },
        subtle: 'var(--text3)',
        destructive: {
          DEFAULT: 'var(--red)',
          bg: 'var(--red-bg)',
          foreground: '#ffffff',
        },
        success: { DEFAULT: 'var(--green)', bg: 'var(--green-bg)' },
        warning: { DEFAULT: 'var(--amber)', bg: 'var(--amber-bg)' },
        info: { DEFAULT: 'var(--teal)', bg: 'var(--teal-bg)' },
        purple: { DEFAULT: 'var(--purple)', bg: 'var(--purple-bg)' },
        graos: 'var(--graos)',
        tabaco: 'var(--tabaco)',
        cacau: { DEFAULT: 'var(--cacau)', bg: 'var(--cacau-bg)' },
        outros: 'var(--outros)',
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius)',
        lg: 'var(--radius-lg)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow)',
        lg: 'var(--shadow-lg)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      // Escala densa de UI corporativa (9-28px) — o padrão text-xs/sm/base
      // do Tailwind é grande demais para esta densidade de tabela/badge.
      fontSize: {
        '2xs': ['9px', '1.3'],
        xs: ['10px', '1.35'],
        sm: ['11px', '1.4'],
        base: ['12px', '1.45'],
        md: ['13px', '1.45'],
        lg: ['14px', '1.5'],
        xl: ['16px', '1.5'],
        '2xl': ['20px', '1.4'],
        '3xl': ['24px', '1.3'],
        '4xl': ['28px', '1.2'],
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeUp: 'fadeUp .35s ease both',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
