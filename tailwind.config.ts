import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FFFDF5',
          100: '#FFF9E5',
          200: '#FFF3CC',
        },
        sketch: {
          dark: '#2D2D2D',
          medium: '#5A5A5A',
          light: '#8A8A8A',
        },
      },
      fontFamily: {
        display: ['"Balsamiq Sans"', 'cursive'],
        body: ['"Balsamiq Sans"', 'cursive'],
      },
      animation: {
        'sketch-draw': 'sketch-draw 0.3s ease-in-out',
        'fade-in': 'fade-in 0.3s ease-in-out',
      },
      keyframes: {
        'sketch-draw': {
          '0%': { strokeDashoffset: '100%' },
          '100%': { strokeDashoffset: '0%' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
