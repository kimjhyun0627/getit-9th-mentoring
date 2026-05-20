import { useTheme } from '@getit/theme';
import { useId } from 'react';

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
 * SVG gradient id는 `useId()` 로 인스턴스별 고유화.
 * 페이지에 여러 토글이 있어도 id 충돌 없음 (CR #181).
 *
 * @param {{ lit: boolean }} props
 */
const Candle = ({ lit }) => {
  const uid = useId();
  const glowId = `candle-glow-${uid}`;
  const flameId = `candle-flame-${uid}`;

  return (
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
          fill={`url(#${glowId})`}
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
          fill={`url(#${flameId})`}
          className="candle-flame"
        />
      ) : null}

      <defs>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F4D7C8" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#E8B89F" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#E8B89F" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={flameId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FBE9B7" />
          <stop offset="55%" stopColor="#E8B89F" />
          <stop offset="100%" stopColor="#D9A892" />
        </linearGradient>
      </defs>
    </svg>
  );
};

/**
 * 필수 internal 클래스 — 어떤 className prop 이 와도 보존되어야 한다.
 * `.candle-toggle` 은 [data-lit='true'] 셀렉터의 글로우 box-shadow 조건이고,
 * `inline-flex` 등은 SVG 정렬에 필수라 컴포넌트 책임.
 */
const INTERNAL_CLASSES =
  'candle-toggle inline-flex h-10 w-10 items-center justify-center rounded-full transition hover:scale-105';

/**
 * 외부에서 className 미지정 시 기본 외관 (cream/mocha2 + ring).
 */
const DEFAULT_LOOK = 'bg-cream ring-1 ring-ink/10 dark:bg-mocha2 dark:ring-beige/20';

/**
 * Warm 페르소나 다크 토글 — 양초 심지 글로우 + flicker (A안).
 *
 * - 라이트 = 양초 꺼짐 (회색 심지, 글로우 없음)
 * - 다크 = 양초 켜짐 (오렌지 플레임 + flicker + 부드러운 글로우)
 *
 * a11y:
 * - `role="switch"` + `aria-checked` 로 다크 상태 표현
 * - `aria-label` 은 상태 무관 고정 ("다크 모드 토글 (양초)") — 상태 변화는
 *   `aria-checked` 가 담당. ARIA 1.2 권장 패턴 (Gemini 리뷰 #181).
 *
 * 키보드: 브라우저 기본 (button + role=switch — Space/Enter 동작).
 *
 * 모션: flicker / glow-pulse 키프레임. `prefers-reduced-motion` 은
 * index.css 에서 모션 제거 + 정적 글로우 유지.
 *
 * className 병합: 필수 internal 클래스는 항상 적용, 외부 className 은
 * 외관(배경/링) 만 오버라이드. 누락 시 DEFAULT_LOOK 사용 (CR #181).
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
      aria-label="다크 모드 토글 (양초)"
      onClick={toggle}
      data-lit={isDark ? 'true' : 'false'}
      className={`${INTERNAL_CLASSES} ${className ?? DEFAULT_LOOK}`}
    >
      <Candle lit={isDark} />
    </button>
  );
};
