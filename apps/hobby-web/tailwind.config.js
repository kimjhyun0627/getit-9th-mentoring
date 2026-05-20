import preset from '@getit/config-tailwind/preset';

/**
 * hobby-web Tailwind config.
 * Playful 페르소나 — 비비드 코랄/라임/라일락/옐로우 4색 그라데이션 카드 + 라운드 디스플레이.
 * Pretendard Variable (본문) + Quicksand/Lexend (display/round).
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
    },
  },
};
