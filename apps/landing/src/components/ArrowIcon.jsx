/**
 * 우측 화살표 아이콘 (시안의 stroke-linecap='square' tech 룩).
 * CTA + 카드 호버 시 `arrow-x` 클래스로 translate-x 됨.
 *
 * @param {{ className?: string; size?: number }} props
 */
export const ArrowIcon = ({ className = 'arrow-x', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
  </svg>
);
