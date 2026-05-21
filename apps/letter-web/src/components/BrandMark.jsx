/**
 * 롤링페이퍼 브랜드 마크 — Warm 페르소나 (#388).
 *
 * 의도: cream/beige 톤의 종이비행기 SVG — 익명 메시지 송신 메타포.
 * - 살짝 기울어진 자세 + 접힌 라인 강조
 * - peachDk / rose 액센트 (light/dark 자동)
 * - hand-drawn 느낌: stroke-linecap round + 스트로크 살짝 변동
 *
 * @param {{ className?: string }} props
 */
export const BrandMark = ({ className = 'h-7 w-7' }) => (
  <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
    {/* 외곽 종이비행기 (peachDk light / rose dark) */}
    <path
      d="M27 5 5 14l8 3.5 2.5 8z"
      className="fill-peachDk/15 stroke-peachDk dark:fill-rose/15 dark:stroke-rose"
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    {/* 접힌 중심 라인 */}
    <path
      d="M27 5 13 17.5"
      className="stroke-peachDk dark:stroke-rose"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeDasharray="0 0"
    />
    {/* 꼬리 그림자 (살짝 변동된 라인) */}
    <path
      d="M13 17.5 15.5 25.5"
      className="stroke-peachDk/70 dark:stroke-rose/70"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
);
