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
  content: ['./index.html', './src/**/*.{js,jsx}'],
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
