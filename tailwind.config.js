/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,js}'],
  theme: {
    extend: {
      colors: {
        bg:        '#1A1A2E',
        'bg-card': '#16213E',
        'bg-hover':'#1F2B47',
        primary:   '#00C853',
        'primary-dark': '#00A344',
        danger:    '#E53935',
        warning:   '#F9A825',
        info:      '#1565C0',
        muted:     '#F5F5F5',
        subtle:    '#94A3B8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      screens: {
        xs: '375px',
      },
    },
  },
  plugins: [],
}
