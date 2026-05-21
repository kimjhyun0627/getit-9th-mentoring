/**
 * 4 프로젝트 카드 아이콘 (#388).
 * 모두 24x24 viewBox · stroke 기반 line-art · currentColor.
 * ProjectCard 의 액센트 토큰 (cyan/magenta/lime/amber) 을 받아 stroke 색을 결정.
 *
 * 의도: 각 프로젝트 헤더 로고와 같은 형태로 grid의 4개를 통일 (이모지 폐기).
 */

const baseProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

/**
 * 취미메이트 — 두 손이 맞닿아 연결되는 모티프 (Playful 톤이지만 카드에선 line-art).
 *
 * @param {{ className?: string }} props
 */
export const HobbyIcon = ({ className = 'size-6' }) => (
  <svg {...baseProps} aria-hidden="true" className={`stroke-current ${className}`}>
    {/* 좌 손 */}
    <path d="M5 14c0-1.5 1-2.5 2.5-2.5h2V8.5a1.5 1.5 0 0 1 3 0V13" />
    <path d="M12.5 13V9a1.5 1.5 0 0 1 3 0v6c0 2.5-1.8 4.5-4.2 4.5H8.7C7.2 19.5 6 18.3 6 16.8V15" />
    {/* 우 손가락 곡선 */}
    <path d="M15.5 11.5 18 9" />
    {/* 모임 점 */}
    <circle cx="19.5" cy="6.5" r="1.4" className="fill-current" />
  </svg>
);

/**
 * 스마트 서재 — 책 3권 세움 + 책갈피 (Editorial 톤).
 *
 * @param {{ className?: string }} props
 */
export const ShelfIcon = ({ className = 'size-6' }) => (
  <svg {...baseProps} aria-hidden="true" className={`stroke-current ${className}`}>
    {/* 책 1 */}
    <rect x="4" y="5" width="3.5" height="14" rx="0.6" />
    {/* 책 2 (살짝 기울어진) */}
    <path d="M9 5.6 12.5 5l1.6 13.8-3.5.5z" />
    {/* 책 3 + 책갈피 */}
    <rect x="15" y="5" width="5" height="14" rx="0.6" />
    <path d="M17 5v6l1-1 1 1V5" className="fill-current/0" />
  </svg>
);

/**
 * 팀 칸반 — 3 컬럼 + 카드 (Minimalist 톤).
 *
 * @param {{ className?: string }} props
 */
export const BoardIcon = ({ className = 'size-6' }) => (
  <svg {...baseProps} aria-hidden="true" className={`stroke-current ${className}`}>
    <rect x="3" y="4" width="5" height="16" rx="1" />
    <rect x="9.5" y="4" width="5" height="16" rx="1" />
    <rect x="16" y="4" width="5" height="16" rx="1" />
    {/* 카드 — todo / doing / done 위치 */}
    <line x1="4.5" y1="8" x2="6.5" y2="8" />
    <line x1="11" y1="8" x2="13" y2="8" />
    <line x1="11" y1="11.5" x2="13" y2="11.5" />
    <line x1="17.5" y1="8" x2="19.5" y2="8" />
    <line x1="17.5" y1="11.5" x2="19.5" y2="11.5" />
    <line x1="17.5" y1="15" x2="19.5" y2="15" />
  </svg>
);

/**
 * 익명 롤링페이퍼 — 포스트잇 + 살짝 접힌 모서리 (Warm 톤).
 *
 * @param {{ className?: string }} props
 */
export const LetterIcon = ({ className = 'size-6' }) => (
  <svg {...baseProps} aria-hidden="true" className={`stroke-current ${className}`}>
    {/* 포스트잇 본체 + 접힌 우하단 */}
    <path d="M4 4h13l3 3v13H4z" />
    <path d="M17 4v3h3" />
    {/* 손글씨 3 줄 */}
    <line x1="7" y1="10" x2="14" y2="10" />
    <line x1="7" y1="13" x2="16" y2="13" />
    <line x1="7" y1="16" x2="12" y2="16" />
  </svg>
);
