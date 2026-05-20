import { useTheme } from '@getit/theme';

/**
 * 양초 SVG — 라이트(꺼짐) / 다크(켜짐) 두 상태를 한 컴포넌트가 그린다.
 *
 * - body: 베이지 양초 몸통 (light:beige / dark:beige2)
 * - wick: 심지 — light 회색, dark 짙은 갈색
 * - flame: 다크 모드에서만 노출 — peachDk → rose 그라디언트
 * - glow:  flame 뒤 부드러운 빛 (radial)
 *
 * 모든 모션은 CSS 키프레임 (index.css `.candle-*`).
 * `aria-hidden` — 시각 전용 (버튼이 role/aria 담당).
 *
 * @param {{ lit: boolean }} props
 */
const Candle = ({ lit }) => (
  <svg
    viewBox="0 0 32 32"
    xmlns="http://www.w3.org/2000/svg"
    className="h-6 w-6 overflow-visible"
    aria-hidden="true"
    focusable="false"
  >
    {/* glow — flame 뒤 부드러운 빛 */}
    {lit ? (
      <circle
        cx="16"
        cy="9"
        r="10"
        fill="url(#candleGlow)"
        className="candle-glow"
        opacity="0.85"
      />
    ) : null}

    {/* 양초 몸통 */}
    <rect x="11" y="14" width="10" height="14" rx="1.5" className="fill-beige dark:fill-beige2" />
    {/* 몸통 그림자 라인 */}
    <rect x="11" y="14" width="2" height="14" className="fill-beige2/60 dark:fill-mocha3/70" />

    {/* 심지 */}
    <rect
      x="15.4"
      y={lit ? 10 : 12}
      width="1.2"
      height={lit ? 3 : 2.5}
      rx="0.4"
      className={lit ? 'fill-mocha2' : 'fill-ink2/70 dark:fill-beige2/60'}
    />

    {/* 불꽃 — 다크일 때만 */}
    {lit ? (
      <path
        d="M16 3 C 18.5 6, 19.2 8.5, 18.6 10.2 C 18.1 11.7, 16.9 12.4, 16 12.4 C 15.1 12.4, 13.9 11.7, 13.4 10.2 C 12.8 8.5, 13.5 6, 16 3 Z"
        fill="url(#candleFlame)"
        className="candle-flame"
      />
    ) : null}

    <defs>
      <radialGradient id="candleGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#F4D7C8" stopOpacity="0.95" />
        <stop offset="55%" stopColor="#E8B89F" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#E8B89F" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="candleFlame" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FBE9B7" />
        <stop offset="55%" stopColor="#E8B89F" />
        <stop offset="100%" stopColor="#D9A892" />
      </linearGradient>
    </defs>
  </svg>
);

/**
 * Warm 페르소나 다크 토글 — 양초 심지 글로우 + flicker (A안).
 *
 * - 라이트 = 양초 꺼짐 (회색 심지, 글로우 없음)
 * - 다크 = 양초 켜짐 (오렌지 플레임 + flicker + 부드러운 글로우)
 *
 * a11y: `role="switch"` + `aria-checked` 로 다크 상태 표현.
 * 키보드: 브라우저 기본 (button 위에 role=switch — Space/Enter 동작).
 * 모션: flicker 키프레임. `prefers-reduced-motion` 은 index.css에서 정적 글로우만 유지.
 *
 * @param {{ className?: string }} props
 */
export const CandleToggle = ({ className }) => {
  const resolved = useTheme((s) => s.resolved);
  const toggle = useTheme((s) => s.toggle);
  const isDark = resolved === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? '양초 끄기 (라이트 모드)' : '양초 켜기 (다크 모드)'}
      onClick={toggle}
      data-lit={isDark ? 'true' : 'false'}
      className={
        className ??
        'candle-toggle inline-flex h-10 w-10 items-center justify-center rounded-full bg-cream ring-1 ring-ink/10 transition hover:scale-105 dark:bg-mocha2 dark:ring-beige/20'
      }
    >
      <Candle lit={isDark} />
    </button>
  );
};
