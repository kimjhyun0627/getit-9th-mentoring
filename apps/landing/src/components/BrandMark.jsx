/**
 * GETIT/9 브랜드 마크 — Tech-Dark 페르소나.
 *
 * 의도: 기존 "G9" 텍스트 모노그램 대신 코드/터미널 미감의 SVG 로 교체 (#388).
 * - 좌우 angle bracket `<` `>` 가 G9 카운터(letterspace) 형성
 * - 가운데 수직 caret 글로우 (cyan accent)
 * - 다크/라이트 양쪽에서 currentColor + accent stroke 사용
 *
 * 사이즈는 호출처에서 className 으로 제어 (size-7 등).
 *
 * @param {{ className?: string; accentClassName?: string; ariaLabel?: string }} props
 */
export const BrandMark = ({
  className = 'h-7 w-7',
  accentClassName = 'text-cyan-700 dark:text-cyan-neon',
  ariaLabel,
}) => (
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
    {/* 좌 bracket */}
    <path
      d="M12 10 L7.5 16 L12 22"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      className={`stroke-current ${accentClassName}`}
    />
    {/* 우 bracket */}
    <path
      d="M20 10 L24.5 16 L20 22"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      className={`stroke-current ${accentClassName}`}
    />
    {/* caret cursor */}
    <line
      x1="16"
      y1="11"
      x2="16"
      y2="21"
      strokeWidth="2"
      strokeLinecap="round"
      className="stroke-cyan-neon"
    />
  </svg>
);
