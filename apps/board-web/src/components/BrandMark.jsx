/**
 * Team Board 브랜드 마크 — Minimalist 페르소나 (#388).
 *
 * 의도: 기존 "B" 텍스트 모노그램 폐기. 칸반의 본질인 3-컬럼 + 카드 라인을 단순화한 SVG.
 * - 외곽 박스 (foreground), 안쪽에 작은 카드 라인 1-2-3 (todo / doing / done)
 * - foreground/background 토큰만 사용 — Minimalist neutral 톤 유지
 *
 * @param {{ className?: string }} props
 */
export const BrandMark = ({ className = 'h-7 w-7' }) => (
  <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
    <rect x="2" y="2" width="24" height="24" rx="6" className="fill-foreground" />
    {/* 3 컬럼 카드 */}
    <rect x="6" y="7" width="4.5" height="3" rx="0.6" className="fill-background" />
    <rect x="11.75" y="7" width="4.5" height="3" rx="0.6" className="fill-background opacity-70" />
    <rect
      x="11.75"
      y="11.5"
      width="4.5"
      height="3"
      rx="0.6"
      className="fill-background opacity-50"
    />
    <rect x="17.5" y="7" width="4.5" height="3" rx="0.6" className="fill-background opacity-30" />
  </svg>
);
