import preset from '@getit/config-tailwind/preset';

/**
 * shelf-web Tailwind config — Editorial 페르소나.
 * - 페이퍼/잉크 라이트 + 미드나잇 차콜 다크
 * - 액센트: 와인(라이트) → 머스타드(다크) — 토큰은 index.css 에서 정의.
 * - 폰트: display(Playfair) / serif(Source Serif 4 + Noto Serif KR) / sans(Pretendard).
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
