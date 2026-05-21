/**
 * Smart Shelf 브랜드 마크 — Editorial 페르소나 (#388).
 *
 * 의도: shelf 의 기존 텍스트 로고 좌측에 작은 책 더미 + 책갈피 SVG 추가.
 * - paper/ink/wine 톤을 그대로 사용 (currentColor 로 ink-strong 상속)
 * - line-art 1.4 stroke — Editorial 의 hairline 미감과 호응
 *
 * @param {{ className?: string }} props
 */
export const BrandMark = ({ className = 'h-6 w-6' }) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
    {/* 책 1 — 세움 */}
    <rect
      x="3.5"
      y="5"
      width="3.5"
      height="14"
      rx="0.6"
      className="stroke-current"
      strokeWidth="1.4"
    />
    {/* 책 2 — 살짝 기울어진 */}
    <path
      d="M8.4 5.5 11.6 5 13 18.6l-3.2.5z"
      className="stroke-current"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    {/* 책 3 — 와인 액센트 + 책갈피 */}
    <rect
      x="14.5"
      y="5"
      width="6"
      height="14"
      rx="0.6"
      className="stroke-current"
      strokeWidth="1.4"
    />
    <path
      d="M16.4 5v6l1.1-1 1.1 1V5"
      className="fill-wine stroke-wine"
      strokeWidth="0.8"
      strokeLinejoin="round"
    />
  </svg>
);
