/**
 * Tech-Dark 카드 액센트 토큰 매핑.
 *
 * data/projects.js의 `accent` 필드와 1:1. ProjectCard가 라이트/다크 모드
 * 양쪽에서 동일한 색상 가족을 그리도록 Tailwind 클래스 묶음을 노출함.
 *
 * - badge: 카드 좌상단 `[NN]` 배지 (border + bg + text)
 * - text: 호스트 라벨 + hover 시 화살표 색
 * - hoverText: group-hover 시 우하단 "open" 라벨 색
 *
 * 색상은 시안(`docs/design/landing/tech-dark.html`)의 카드 4종과 동일.
 */

/** @typedef {'cyan' | 'magenta' | 'lime' | 'amber'} ProjectAccent */

/**
 * @typedef {object} AccentClasses
 * @property {string} badge - `[NN]` 인덱스 배지 분리자
 * @property {string} text - 호스트 라벨/링크 텍스트
 * @property {string} hoverText - group-hover 시 액센트로 바뀌는 텍스트
 */

/** @type {Record<ProjectAccent, AccentClasses>} */
export const ACCENT_CLASSES = {
  cyan: {
    badge:
      'border border-cyan-700/30 bg-cyan-50 text-cyan-700 dark:border-cyan-neon/40 dark:bg-cyan-neon/10 dark:text-cyan-neon',
    text: 'text-cyan-700 dark:text-cyan-neon',
    hoverText: 'group-hover:text-cyan-700 dark:group-hover:text-cyan-neon',
  },
  magenta: {
    badge:
      'border border-fuchsia-700/30 bg-fuchsia-50 text-fuchsia-700 dark:border-magenta-neon/40 dark:bg-magenta-neon/10 dark:text-magenta-neon',
    text: 'text-fuchsia-700 dark:text-magenta-neon',
    hoverText: 'group-hover:text-fuchsia-700 dark:group-hover:text-magenta-neon',
  },
  lime: {
    badge:
      'border border-lime-700/30 bg-lime-50 text-lime-700 dark:border-lime-neon/40 dark:bg-lime-neon/10 dark:text-lime-neon',
    text: 'text-lime-700 dark:text-lime-neon',
    hoverText: 'group-hover:text-lime-700 dark:group-hover:text-lime-neon',
  },
  amber: {
    badge:
      'border border-amber-700/30 bg-amber-50 text-amber-700 dark:border-amber-neon/40 dark:bg-amber-neon/10 dark:text-amber-neon',
    text: 'text-amber-700 dark:text-amber-neon',
    hoverText: 'group-hover:text-amber-700 dark:group-hover:text-amber-neon',
  },
};
