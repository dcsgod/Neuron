/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Neuron Design System
        bg: {
          base: '#0a0a0f',
          surface: '#12121a',
          elevated: '#1e1e2e',
          high: '#252535',
        },
        border: {
          subtle: '#1e1e2e',
          DEFAULT: '#2a2a3d',
          strong: '#3a3a55',
        },
        accent: {
          DEFAULT: '#7c3aed',
          light: '#a78bfa',
          dim: '#4c1d95',
          glow: 'rgba(124, 58, 237, 0.3)',
        },
        success: {
          DEFAULT: '#10b981',
          dim: '#064e3b',
        },
        warning: {
          DEFAULT: '#f59e0b',
          dim: '#78350f',
        },
        error: {
          DEFAULT: '#ef4444',
          dim: '#7f1d1d',
        },
        text: {
          primary: '#e2e8f0',
          secondary: '#94a3b8',
          muted: '#64748b',
          accent: '#a78bfa',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        xs: ['11px', '15px'],
        sm: ['12px', '16px'],
        base: ['13px', '18px'],
        md: ['14px', '20px'],
        lg: ['16px', '22px'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(124, 58, 237, 0.25)',
        'glow-sm': '0 0 10px rgba(124, 58, 237, 0.15)',
        panel: '0 4px 24px rgba(0, 0, 0, 0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
        shimmer: 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
