import { useTheme } from '@getit/theme';

import { cn } from '../lib/cn.js';

/**
 * Editorial 페르소나 — 다크 토글 (책 페이지 3D flip, A안).
 *
 * 시안 `docs/design/shelf/editorial.html` 의 매거진/도서관 정서 위에
 * 한 페이지를 넘기는 작은 손짓을 얹는다. 두 면(앞·뒤)이 perspective +
 * `rotateY(180deg)` 로 뒤집힌다.
 *
 * - store 는 `@getit/theme` 공유 — 다른 5개 FE 앱 영향 0
 * - role="switch" + aria-checked + Space/Enter 키보드 동작
 * - `prefers-reduced-motion: reduce` 시 트랜지션 0 (즉시 스왑)
 * - currentColor 만 사용 — paper/ink 토큰과 자연스럽게 호흡
 *
 * @param {{ className?: string }} props
 */
export const BookFlipToggle = ({ className }) => {
  const resolved = useTheme((s) => s.resolved);
  const toggle = useTheme((s) => s.toggle);
  const isDark = resolved === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? '라이트모드로 전환' : '다크모드로 전환'}
      onClick={toggle}
      className={cn(
        'book-flip-toggle smallcaps relative inline-flex items-center justify-center',
        'h-9 w-[3.25rem] rounded-[2px] border text-[11px] uppercase',
        'transition-colors duration-300 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'focus-visible:ring-[var(--wine)] focus-visible:ring-offset-[var(--paper-1)]',
        className,
      )}
      style={{ borderColor: 'var(--rule-2)', perspective: '600px' }}
    >
      <span className="sr-only">{isDark ? '다크모드 켜짐' : '다크모드 꺼짐'}</span>

      {/* 책장 카드 — 3D flip wrapper */}
      <span
        aria-hidden="true"
        className={cn(
          'book-flip-card relative block h-[1.6rem] w-[2.5rem]',
          'transition-transform duration-[520ms] ease-[cubic-bezier(0.65,0.05,0.36,1)]',
          isDark && 'is-dark',
        )}
        style={{
          transformStyle: 'preserve-3d',
          transform: isDark ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* 앞면 — light: 종이 위 'day' */}
        <span
          className="book-flip-face flex items-center justify-center font-serif text-[12px] tracking-wider"
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            background: 'var(--paper-2)',
            color: 'var(--ink-1)',
            borderRight: '1px solid var(--rule-1)',
          }}
        >
          day
        </span>

        {/* 뒷면 — dark: 잉크 위 'night' (180도 뒤집힌 면) */}
        <span
          className="book-flip-face flex items-center justify-center font-serif text-[12px] tracking-wider"
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: 'var(--ink-1)',
            color: 'var(--paper-1)',
            borderLeft: '1px solid var(--rule-2)',
          }}
        >
          night
        </span>
      </span>
    </button>
  );
};
