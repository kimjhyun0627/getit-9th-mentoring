/**
 * Auth 브랜드 마크 — Tech-Dark + SSO/lock 모티프 (#388).
 *
 * 의도: landing 의 `< | >` BrandMark 와 같은 박스/톤을 유지하되,
 * 가운데에 자물쇠 + 키홀 모양을 그려 "auth = locked session" 을 시각화.
 * - 다크: cyan-neon 보더 + cyan-neon stroke
 * - 라이트: ink-950 box + cyan-700 stroke
 *
 * @param {{ className?: string; ariaLabel?: string }} props
 */
export const BrandMark = ({ className = 'h-7 w-7', ariaLabel }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    role={ariaLabel ? 'img' : undefined}
    aria-label={ariaLabel}
    aria-hidden={ariaLabel ? undefined : 'true'}
    className={className}
  >
    <rect
      x="1.5"
      y="1.5"
      width="29"
      height="29"
      rx="6"
      className="fill-ink-950 stroke-ink-900 dark:fill-cyan-neon/10 dark:stroke-cyan-neon/40"
      strokeWidth="1"
    />
    {/* 자물쇠 shackle */}
    <path
      d="M11.5 14V11.5a4.5 4.5 0 0 1 9 0V14"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="stroke-cyan-700 dark:stroke-cyan-neon"
    />
    {/* 자물쇠 본체 */}
    <rect
      x="9"
      y="14"
      width="14"
      height="10"
      rx="2"
      strokeWidth="1.8"
      className="stroke-cyan-700 dark:stroke-cyan-neon"
    />
    {/* 키홀 */}
    <circle cx="16" cy="18.5" r="1.4" className="fill-cyan-neon" />
    <line
      x1="16"
      y1="19.5"
      x2="16"
      y2="21.5"
      strokeWidth="1.6"
      strokeLinecap="round"
      className="stroke-cyan-neon"
    />
  </svg>
);
