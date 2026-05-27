/**
 * 4 프로젝트 카드 아이콘 — 각 web 의 `public/favicon.svg` 와 동일 모티프로 통일 (#597).
 *
 * 정착 히스토리:
 *   - #388 — 이모지 폐기 → 라인 아트 SVG 4종.
 *   - #534 — 6 페르소나 favicon SVG 정착 (각 web `BrandMark` 모티프 추출).
 *   - #597 — landing 카드 아이콘 ↔ favicon 모티프 어긋남 해소. favicon path 그대로
 *     가져와 `currentColor` 로 정규화. ProjectCard wrapper 의 액센트 토큰
 *     (`tokens.text` = cyan/magenta/lime/amber) 이 color 를 결정.
 *
 * 색상 정규화 규칙:
 *   - favicon 은 brand color 박혀있음 (rose-gradient / wine-mustard / paper-ink / peach).
 *   - landing 카드는 ProjectCard wrapper 가 색을 입혀야 하므로 모든 fill/stroke 를
 *     `currentColor` 로. `fill-opacity` 만 살려서 favicon 의 layered 톤을 유지.
 *   - favicon 의 외곽 둥근 박스 (rect rx=12 등) 는 카드 wrapper 가 이미 둥근 박스
 *     (`grid size-12 rounded-lg`) 를 제공하므로 stroke 라인으로 정규화하거나 생략.
 *
 * Source-of-truth: 각 `apps/<name>-web/public/favicon.svg`. favicon 디자인이
 * 바뀌면 본 파일도 동기화 (path 데이터 1:1 이식 + currentColor 정규화).
 */

/**
 * 취미메이트 — `apps/hobby-web/public/favicon.svg` Playful 모티프.
 * 두 사람 머리 (favicon 의 white circles) + 어깨 곡선 (favicon 의 white stroke).
 * favicon 의 rose→fuchsia→violet gradient 박스는 wrapper 가 액센트 색으로 대체.
 *
 * @param {{ className?: string }} props
 */
export const HobbyIcon = ({ className = 'size-6' }) => (
  <svg viewBox="0 0 40 40" aria-hidden="true" className={`fill-current ${className}`}>
    {/* favicon 외곽 둥근 박스 — wrapper 박스와 중복되지만 favicon 형태 보존 위해 stroke 로 표현 */}
    <rect
      x="1"
      y="1"
      width="38"
      height="38"
      rx="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    {/* 두 사람 머리 */}
    <circle cx="15.5" cy="17" r="4.5" />
    <circle cx="24.5" cy="17" r="4.5" />
    {/* 어깨 곡선 */}
    <path
      d="M8 30c1.5-4.5 5.5-7 9-7 1.6 0 2.7.4 3 1 .3-.6 1.4-1 3-1 3.5 0 7.5 2.5 9 7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * 스마트 서재 — `apps/shelf-web/public/favicon.svg` Editorial 모티프.
 * 책 3권 (좌 rect, 중간 기울어진 path, 우 rect) + 책갈피 path.
 * favicon 의 wine(light)/mustard(dark) 책갈피 톤은 wrapper 액센트로 대체.
 *
 * @param {{ className?: string }} props
 */
export const ShelfIcon = ({ className = 'size-6' }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={`stroke-current ${className}`}>
    {/* 책 1 */}
    <rect x="3.5" y="5" width="3.5" height="14" rx="0.6" fill="none" strokeWidth="1.4" />
    {/* 책 2 — 살짝 기울어진 */}
    <path
      d="M8.4 5.5 11.6 5 13 18.6l-3.2.5z"
      fill="none"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    {/* 책 3 */}
    <rect x="14.5" y="5" width="6" height="14" rx="0.6" fill="none" strokeWidth="1.4" />
    {/* 책갈피 — favicon 의 accent fill 을 currentColor 로 정규화 */}
    <path
      d="M16.4 5v6l1.1-1 1.1 1V5"
      fill="currentColor"
      strokeWidth="0.8"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * 팀 칸반 — `apps/board-web/public/favicon.svg` Minimalist 모티프.
 * 둥근 박스 (favicon 의 bg) + 카드 4개 (opacity ladder 1.0 / 0.7 / 0.5 / 0.3).
 *
 * favicon 은 dark box + light card 컨트라스트. landing 카드는 wrapper 가 액센트
 * 색을 입히므로 box=액센트(currentColor), card 영역은 SVG `mask` 로 cutout
 * 처리해서 wrapper 배경색이 자연스럽게 비치게 함 (#598 Gemini 리뷰).
 *
 * mask cutout 방식의 장점:
 *   - wrapper 배경색에 하드코딩 의존 없음. wrapper 가 `zinc-50` 이든 `ink-850` 이든
 *     glass-bg 든 카드 자리가 자동으로 wrapper 색이 됨.
 *   - opacity ladder (0.7 / 0.5 / 0.3) 는 mask 의 `fill-opacity` 로 표현 —
 *     0.3 fill 은 70% 가 mask 통과(액센트), 30% 가 cutout(wrapper 배경) → 옅은 카드.
 *
 * @param {{ className?: string }} props
 */
export const BoardIcon = ({ className = 'size-6' }) => (
  <svg viewBox="0 0 28 28" aria-hidden="true" className={`fill-current ${className}`}>
    <defs>
      <mask id="board-icon-mask">
        {/* mask 배경 = white = 액센트 색 표시 */}
        <rect x="0" y="0" width="28" height="28" fill="white" />
        {/* 카드 4개 = black = cutout (wrapper 배경 노출). fill-opacity 로 ladder */}
        <rect x="6" y="7" width="4.5" height="3" rx="0.6" fill="black" />
        <rect x="11.75" y="7" width="4.5" height="3" rx="0.6" fill="black" fillOpacity="0.7" />
        <rect x="11.75" y="11.5" width="4.5" height="3" rx="0.6" fill="black" fillOpacity="0.5" />
        <rect x="17.5" y="7" width="4.5" height="3" rx="0.6" fill="black" fillOpacity="0.3" />
      </mask>
    </defs>
    {/* 외곽 박스 — favicon 의 dark bg = wrapper 액센트 색. mask 로 카드 영역 cutout */}
    <rect x="2" y="2" width="24" height="24" rx="6" mask="url(#board-icon-mask)" />
  </svg>
);

/**
 * 익명 롤링페이퍼 — `apps/letter-web/public/favicon.svg` Warm 모티프.
 * 종이비행기 (삼각형 body fill-opacity 0.18 + 접힘 사선 + 꼬리 사선).
 * favicon 의 peach/rose 톤은 wrapper 액센트로 대체.
 *
 * @param {{ className?: string }} props
 */
export const LetterIcon = ({ className = 'size-6' }) => (
  <svg viewBox="0 0 32 32" aria-hidden="true" className={`stroke-current ${className}`}>
    {/* 비행기 body */}
    <path
      d="M27 5 5 14l8 3.5 2.5 8z"
      fill="currentColor"
      fillOpacity="0.18"
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    {/* 접힘 사선 */}
    <path d="M27 5 13 17.5" fill="none" strokeWidth="1.4" strokeLinecap="round" />
    {/* 꼬리 사선 */}
    <path
      d="M13 17.5 15.5 25.5"
      fill="none"
      strokeOpacity="0.7"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
);
