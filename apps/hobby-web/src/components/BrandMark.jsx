/**
 * 취미메이트 브랜드 마크 — Playful 페르소나 (#388).
 *
 * 의도: 기존 🤲 이모지 폐기. 두 손이 맞닿아 "연결" 되는 두 원 + 손가락 라인,
 *   그라데이션 (rose → fuchsia → violet) 으로 Playful 톤 유지.
 * - 둥근 사각 배경 + 그라데이션
 * - 안쪽 두 원이 살짝 겹쳐 "모임" 표현
 *
 * @param {{ className?: string }} props
 */
export const BrandMark = ({ className = 'h-10 w-10' }) => (
  <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" className={className}>
    <defs>
      <linearGradient id="hobby-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fb7185" />
        <stop offset="55%" stopColor="#d946ef" />
        <stop offset="100%" stopColor="#8b5cf6" />
      </linearGradient>
    </defs>
    <rect x="1" y="1" width="38" height="38" rx="12" fill="url(#hobby-grad)" />
    {/* 두 원 (사람) 겹침 */}
    <circle cx="15.5" cy="17" r="4.5" fill="#fff" />
    <circle cx="24.5" cy="17" r="4.5" fill="#fff" />
    {/* 어깨 (모임) — 두 곡선 결합 */}
    <path
      d="M8 30c1.5-4.5 5.5-7 9-7 1.6 0 2.7.4 3 1 .3-.6 1.4-1 3-1 3.5 0 7.5 2.5 9 7"
      stroke="#fff"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);
