import preset from '@getit/config-tailwind/preset';

/**
 * auth-web Tailwind config.
 * Landing과 동일한 Minimalist 톤 — zinc 베이스 + 인디고 단일 액센트 + 1px hairline.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  presets: [preset],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
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
