import { useTheme } from '@getit/theme';
import { useEffect, useRef, useState } from 'react';

import './PlayfulThemeToggle.css';

/**
 * 취미메이트 Playful 페르소나 전용 다크 토글.
 *
 * 시안: docs/design/hobby/toggle.html A안 (햇님↔달 슬라이드 + 별 페이드).
 * - 트랙: 라이트 = amber 그라데이션 / 다크 = indigo→violet 그라데이션
 * - puck: spring easing 으로 우측 슬라이드 + 360° 회전, 햇님→달 이모지 교체
 * - rays: 라이트 모드에서만 보임 (다크 전환 시 페이드아웃)
 * - stars: 다크 모드에서만 페이드인 — "별 페이드" 효과
 *
 * 동작 보존: `@getit/theme` store 의 `useTheme` 그대로 사용해서
 *           다른 5개 앱 (auth/landing/shelf/board/letter) 과 상태 sync.
 *
 * a11y:
 *  - `role="switch"` + `aria-checked` (지정된 패턴)
 *  - 키보드: button 기본 동작 (Space/Enter) — 추가 핸들러 불필요
 *  - `prefers-reduced-motion` 시 트랜지션/회전 자동 무효화 (index.css)
 *
 * @param {{ className?: string }} props
 */
export const PlayfulThemeToggle = ({ className = '' }) => {
  const resolved = useTheme((s) => s.resolved);
  const toggle = useTheme((s) => s.toggle);
  const isDark = resolved === 'dark';
  const [bouncing, setBouncing] = useState(false);
  const timerRef = useRef(/** @type {number | null} */ (null));

  // 토글 직후 600ms 동안 'bouncing' 클래스 부착 → spring 모션 1회 재생.
  // 컴포넌트가 unmount 되면 타이머 정리.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleClick = () => {
    toggle();
    setBouncing(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setBouncing(false), 600);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? '라이트모드로 전환' : '다크모드로 전환'}
      onClick={handleClick}
      data-bouncing={bouncing ? 'true' : 'false'}
      className={`playful-toggle ${className}`.trim()}
    >
      {/* puck — 햇님/달 이모지가 들어가는 흰 동그라미. 슬라이드 + 회전. */}
      <span className="playful-toggle__puck" aria-hidden="true">
        <span className="playful-toggle__icon playful-toggle__icon--sun">☀️</span>
        <span className="playful-toggle__icon playful-toggle__icon--moon">🌙</span>
      </span>
      {/* rays — 라이트 모드에서 햇살 ✦ 두 개 (mockup ::before/::after 1:1) */}
      <span className="playful-toggle__rays" aria-hidden="true" />
      {/* stars — 다크 모드에서 별 ⋆ 두 개 페이드 인 */}
      <span className="playful-toggle__stars" aria-hidden="true" />
    </button>
  );
};
