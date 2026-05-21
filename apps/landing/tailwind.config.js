import preset from '@getit/config-tailwind/preset';

/**
 * Landing app Tailwind config.
 * Tech-Dark 시안 토큰 확장.
 * - 베이스: zinc 계열 ink palette (다크 기본)
 * - 네온 액센트 4종: cyan / magenta / lime / amber (카드 hover 색 분배)
 * - 폰트: JetBrains Mono (heading/meta) + Inter, Pretendard (body)
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  presets: [preset],
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
    // packages/theme 의 컴포넌트 (CodeTerminalToggle 등) 클래스도
    // purge 보존되도록 scan. 미포함 시 dark:text-cyan-300 류가 빌드 CSS에서
    // 삭제돼 라이브에서 텍스트 색이 안 먹는 사고 발생 (#377).
    '../../packages/theme/src/**/*.{js,jsx}',
  ],
  // 토글 솔리드 배경 (#379) — packages/theme 가 어떤 alpha 표기로 들어와도
  // 라이브에서 흰색 fallback 으로 보이지 않도록 안전한 솔리드 ink 색을
  // safelist 에 박아둔다.
  safelist: ['bg-ink-900', 'bg-ink-950', 'dark:bg-ink-900', 'dark:bg-ink-950'],
  theme: {
    extend: {
      colors: {
        // 카드 hover + 본문 액센트용 네온 4종.
        cyan: { neon: '#22d3ee' },
        magenta: { neon: '#e879f9' },
        lime: { neon: '#a3e635' },
        amber: { neon: '#fbbf24' },
        // 다크 베이스 (zinc 계열 ink).
        ink: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#1f2228',
          800: '#16181d',
          850: '#101114',
          900: '#0c0d10',
          950: '#08090b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Pretendard Variable', 'Pretendard', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', '"SF Mono"', 'monospace'],
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
