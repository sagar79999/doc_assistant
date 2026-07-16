/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        g: {
          bg:      '#09090f',
          sidebar: '#0e0e18',
          card:    '#13131f',
          border:  '#1f1f2e',
          muted:   '#6b6b8a',
          text:    '#F0F2F0',
          accent:  '#A78BFA',
          accentd: '#7C3AED',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'accent-sm': '0 0 12px rgba(167,139,250,0.18)',
        'accent-md': '0 0 24px rgba(167,139,250,0.22)',
        'accent-lg': '0 0 40px rgba(167,139,250,0.28)',
        'card':      '0 4px 32px rgba(0,0,0,0.5)',
      },
      keyframes: {
        fadeUp:     { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeIn:     { from: { opacity: '0' },                                to: { opacity: '1' } },
        slideRight: { from: { opacity: '0', transform: 'translateX(20px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        slideLeft:  { from: { opacity: '0', transform: 'translateX(-20px)' },to: { opacity: '1', transform: 'translateX(0)' } },
        pulseAccent:{ '0%,100%': { boxShadow: '0 0 0 0 rgba(167,139,250,0.4)' }, '50%': { boxShadow: '0 0 0 6px rgba(167,139,250,0)' } },
        shimmer:    { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        scaleIn:    { from: { opacity: '0', transform: 'scale(0.95)' },       to: { opacity: '1', transform: 'scale(1)' } },
        bounceIn:   { '0%': { transform: 'scale(0.8)', opacity: '0' }, '60%': { transform: 'scale(1.05)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
      },
      animation: {
        'fade-up':      'fadeUp 0.4s cubic-bezier(0.4,0,0.2,1) forwards',
        'fade-in':      'fadeIn 0.3s ease forwards',
        'slide-right':  'slideRight 0.35s cubic-bezier(0.4,0,0.2,1) forwards',
        'slide-left':   'slideLeft 0.35s cubic-bezier(0.4,0,0.2,1) forwards',
        'pulse-accent': 'pulseAccent 2s ease-in-out infinite',
        'shimmer':      'shimmer 2.5s linear infinite',
        'scale-in':     'scaleIn 0.25s cubic-bezier(0.4,0,0.2,1) forwards',
        'bounce-in':    'bounceIn 0.4s cubic-bezier(0.4,0,0.2,1) forwards',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
