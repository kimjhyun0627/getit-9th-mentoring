import preset from '@getit/config-tailwind/preset';

/**
 * hobby-web Tailwind config.
 * Playful 페르소나 — 비비드 그라데이션 + 라운드 디스플레이 + 이모지.
 * 색은 Tailwind 의 기본 rose/violet/amber/emerald 팔레트를 그대로 활용.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  presets: [preset],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', 'system-ui', 'sans-serif'],
        display: ['Lexend', 'Quicksand', 'Pretendard Variable', 'sans-serif'],
        round: ['Quicksand', 'Lexend', 'Pretendard Variable', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
    },
  },
};
