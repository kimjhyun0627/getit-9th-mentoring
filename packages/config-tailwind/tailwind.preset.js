/**
 * Tailwind base preset — 6개 FE 앱 공통.
 * `darkMode: 'class'` 전략 (shadcn/ui와 호환).
 * 각 프로젝트는 이 preset을 import한 뒤 자체 디자인 토큰을 덮어쓰면 됨.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  darkMode: 'class',
  // packages/theme 컴포넌트 (CodeTerminalToggle 등) 의 클래스가
  // 모든 앱 빌드 CSS 에 보존되도록 preset 단에서 보장 (#378, Gemini 제안).
  // 각 앱은 자체 `content` 에 `./index.html`, `./src/**/*.{js,jsx}` 만 추가하면 됨.
  // Tailwind 는 preset content 와 앱 content 를 머지함.
  content: ['../../packages/theme/src/**/*.{js,jsx}'],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        lg: '2rem',
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1440px',
      },
    },
    extend: {
      // shadcn/ui와 통합되는 CSS variable 기반 색 토큰.
      // 실제 색은 각 앱의 globals.css에서 :root / .dark 로 정의.
      colors: {
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'D2Coding', 'monospace'],
      },
    },
  },
  plugins: [],
};
