import preset from '@getit/config-tailwind/preset';

/**
 * board-web Tailwind config.
 * Minimalist 톤 — zinc 베이스 + 인디고 단일 액센트 + 1px hairline.
 * `docs/design/board/minimalist.html` 시안과 1:1 매칭.
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
