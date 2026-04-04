module.exports = {
  content: [
      "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  variants: {
    extend: {
      display: ['group-hover'],
    },
  },
  theme: {
      extend: {
        fontFamily: {
          sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
          mono: ['"JetBrains Mono"', '"Fira Code"', '"Roboto Mono"', 'monospace'],
        },
        textShadow: {
          glow: "0 0 8px rgba(139, 92, 246, 0.5), 0 0 16px rgba(139, 92, 246, 0.25)",
          'glow-sm': "0 0 4px rgba(139, 92, 246, 0.4)",
        },
        colors: {
          // Dark-first color palette
          primary: {
            50: '#f5f3ff',
            100: '#ede9fe',
            200: '#ddd6fe',
            300: '#c4b5fd',
            400: '#a78bfa',
            500: '#8b5cf6',
            600: '#7c3aed',
            700: '#6d28d9',
            800: '#5b21b6',
            900: '#4c1d95',
            950: '#2e1065',
          },
          accent: {
            DEFAULT: '#8b5cf6',
            light: '#a78bfa',
            dark: '#7c3aed',
            muted: 'rgba(139, 92, 246, 0.15)',
          },
          gray: {
            50: '#f8fafc',
            100: '#f1f5f9',
            200: '#e2e8f0',
            300: '#cbd5e1',
            400: '#94a3b8',
            500: '#64748b',
            600: '#475569',
            700: '#334155',
            800: '#1e293b',
            850: '#172033',
            900: '#0f172a',
            950: '#0a0f1e',
          },
          // Severity palette — refined for dark theme
          severity: {
            critical: { DEFAULT: '#ef4444', light: '#fca5a5', dark: '#dc2626', bg: 'rgba(239,68,68,0.1)', text: '#fca5a5' },
            high:     { DEFAULT: '#f97316', light: '#fdba74', dark: '#ea580c', bg: 'rgba(249,115,22,0.1)', text: '#fdba74' },
            medium:   { DEFAULT: '#eab308', light: '#fde047', dark: '#ca8a04', bg: 'rgba(234,179,8,0.1)', text: '#fde047' },
            low:      { DEFAULT: '#3b82f6', light: '#93c5fd', dark: '#2563eb', bg: 'rgba(59,130,246,0.1)', text: '#93c5fd' },
            info:     { DEFAULT: '#64748b', light: '#94a3b8', dark: '#475569', bg: 'rgba(100,116,139,0.1)', text: '#94a3b8' },
          },
          // Surface colors for layered UI
          surface: {
            DEFAULT: '#ffffff',
            dark: '#0a0f1e',
            elevated: '#f8fafc',
            'elevated-dark': '#111a2e',
            card: '#131928',
            'card-hover': '#1a2340',
            overlay: 'rgba(0, 0, 0, 0.6)',
          },
        },
        borderColor: {
          subtle: 'rgba(255, 255, 255, 0.06)',
          'subtle-light': 'rgba(0, 0, 0, 0.06)',
        },
        backgroundColor: {
          'glass': 'rgba(255, 255, 255, 0.03)',
          'glass-hover': 'rgba(255, 255, 255, 0.06)',
          'glass-active': 'rgba(255, 255, 255, 0.1)',
        },
        boxShadow: {
          'glow': '0 0 20px rgba(139, 92, 246, 0.15)',
          'glow-sm': '0 0 10px rgba(139, 92, 246, 0.1)',
          'glow-lg': '0 0 40px rgba(139, 92, 246, 0.2)',
          'card': '0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)',
          'card-hover': '0 8px 25px rgba(0, 0, 0, 0.4), 0 0 20px rgba(139, 92, 246, 0.08)',
          'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        },
        animation: {
          'fade-in': 'fadeIn 0.4s ease-out',
          'slide-up': 'slideUp 0.3s ease-out',
          'scale-in': 'scaleIn 0.2s ease-out',
          'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
          'shimmer': 'shimmer 2s linear infinite',
        },
        keyframes: {
          fadeIn: {
            '0%': { opacity: '0', transform: 'translateY(8px)' },
            '100%': { opacity: '1', transform: 'translateY(0)' },
          },
          slideUp: {
            '0%': { opacity: '0', transform: 'translateY(16px)' },
            '100%': { opacity: '1', transform: 'translateY(0)' },
          },
          scaleIn: {
            '0%': { opacity: '0', transform: 'scale(0.97)' },
            '100%': { opacity: '1', transform: 'scale(1)' },
          },
          pulseGlow: {
            '0%, 100%': { boxShadow: '0 0 10px rgba(139, 92, 246, 0.1)' },
            '50%': { boxShadow: '0 0 20px rgba(139, 92, 246, 0.25)' },
          },
          shimmer: {
            '0%': { backgroundPosition: '-200% 0' },
            '100%': { backgroundPosition: '200% 0' },
          },
        },
      },
  },
  plugins: [
    require("tailwindcss-textshadow"),
  ],
};