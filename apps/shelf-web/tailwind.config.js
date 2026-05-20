import preset from '@getit/config-tailwind/preset';

/**
 * shelf-web Tailwind config.
 * Editorial 페르소나 — paper / charcoal 베이스 + wine(light) / mustard(dark) 액센트.
 * 본문은 Pretendard, display는 Playfair Display, serif 본문은 Source Serif + Noto Serif KR.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  presets: [preset],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        serif: ['"Source Serif 4"', '"Noto Serif KR"', 'Georgia', 'serif'],
        serifkr: ['"Noto Serif KR"', '"Source Serif 4"', 'Georgia', 'serif'],
      },
      letterSpacing: {
        tightest: '-0.045em',
        hero: '-0.02em',
      },
      maxWidth: {
        '7xl': '80rem',
      },
    },
  },
};
