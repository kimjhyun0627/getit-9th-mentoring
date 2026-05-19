import preset from '@getit/config-tailwind/preset';

/**
 * Landing app Tailwind config.
 * Minimalist 시안의 max-w-7xl + 단일 인디고 액센트만 추가 extend.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  presets: [preset],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Minimalist 시안 단일 액센트. 본문 텍스트엔 안 씀.
        indigo: {
          accent: '#4f46e5',
        },
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      maxWidth: {
        '7xl': '80rem',
      },
    },
  },
};
