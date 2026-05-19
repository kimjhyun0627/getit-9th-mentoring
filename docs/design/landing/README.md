# Landing 디자인 시안 — 5 페르소나 샷건

> 2026-05-19 design-shotgun 결과. 각 시안은 단일 HTML 파일로 **라이트 + 다크 + 실시간 토글** 모두 한 페이지에 포함. 브라우저로 열어서 비교.
>
> 멘토(=사용자) 선택 → FE Engineer가 React + Tailwind + shadcn으로 실 구현.

## 비교 표

| #   | 페르소나       | 정체성 한 줄                                                                        | 색감                                                  | 시안                                 |
| :-- | :------------- | :---------------------------------------------------------------------------------- | :---------------------------------------------------- | :----------------------------------- |
| 1   | **Minimalist** | 깎아낸 우아함 — 화이트스페이스와 1px 라인으로 말하는 절제된 프로덕트                | 화이트 + 슬레이트 + 인디고 액센트 1개                 | [minimalist.html](./minimalist.html) |
| 2   | **Playful**    | 비뚤어진 컬러 스티커들이 통통 튀는, "눌러보고 싶은" 학회 허브                       | 카드별 4색 그라데이션 (산호·라임·바이올렛·선셋)       | [playful.html](./playful.html)       |
| 3   | **Warm**       | 오후 3시 카페에서 정성껏 손편지를 적는 멘토링                                       | 크림 베이지 + 세이지 + 피치 / 다크는 모카 브라운      | [warm.html](./warm.html)             |
| 4   | **Tech-Dark**  | 엔지니어가 IDE 옆에 띄워두고 싶은 정밀 콘솔 — 네온은 한 번씩만, 모노스페이스가 주연 | 잉크 베이스 + 카드별 네온 1색 (시안/마젠타/라임/앰버) | [tech-dark.html](./tech-dark.html)   |
| 5   | **Editorial**  | 네 개의 프로젝트를 한 권의 잡지처럼 — 큰 세리프와 hairline, 와인빛 잉크 한 방울     | 페이퍼 화이트 + 잉크 블랙 + **와인** 액센트           | [editorial.html](./editorial.html)   |

## 시안별 핵심 결정

### 1. Minimalist (Linear · Vercel · Stripe 톤)

- **단일 인디고 액센트** (`#4f46e5`) — eyebrow 도트 + 호버 화살표에만
- **1px hairline 시스템** — 그림자 0, gap-px 트릭으로 카드 사이 1px 라인 (Linear 시그니처)
- 카드 그리드: **4-up @1280px** (균등 4열)
- 타이포: Pretendard Variable, H1 7xl + tracking-tightest, 위계는 크기+색+tracking 3축만
- 다크 = `zinc-950` (pure black 회피) + CTA 인버스 (흰 버튼/검은 글씨)

### 2. Playful (Notion · Linktree · Duolingo 톤)

- **비대칭 12-col 그리드** (Row1: 7+5 / Row2: 5+7) — Z-패턴 시선 흐름
- **4 카드 = 4 그라데이션**:
  - 🤲 취미메이트 — Coral (`#FFB199 → #FF3D7F`)
  - 📚 스마트 서재 — Lime (`#C8F284 → #14B8A6`)
  - 💻 팀 칸반 — Violet (`#C4B5FD → #6366F1`)
  - 🎤 익명 롤링페이퍼 — Sun (`#FDE68A → #F43F5E`)
- 카드마다 회전각 다름 (-2.2° / +2° / -1° / +1.4°) — 호버 시 정렬 + 700ms 바운스
- 이모지 6xl 큰 비주얼, 다크는 채도 -25% + glow shadow

### 3. Warm (카페 · 손편지 · 한글 친화)

- **종이 질감** (SVG fractalNoise multiply) + **워시 테이프 데코** (3색 종이 테이프 조각)
- **손글씨 폰트 Gaegu** 액센트 — 로고 "G", "9기"의 9, "우리가 만들고 있어요" 부제
- **곡선 강조** — `rounded-blob 28px` 카드 + 둥근 CTA + 손그림 SVG 밑줄
- 카드 2x2 그리드, 호버 시 살짝 부풀기 + 미세 회전 (-0.25°)
- 다크 = `#2C2420` 모카 브라운 + 따뜻한 베이지/로즈/세이지 (**블랙 안 씀**)

### 4. Tech-Dark (linear.app/method · vercel/v0 · github/dark 톤)

- **터미널 패널**이 히어로 우측에 — macOS chrome + `getit ls --tree` 출력
- **카드 1장 = neon 1색 할당** — 호버 시 같은 hue glow + 1px border 강조
- 카드 라벨 `[01] HOBBY`, ticket-style ID `ID: HBY-01`, CTA `./explore --all`
- 등록 마크 (4 코너 +), 스캔라인 오버레이, 헤더 캐럿 깜빡임
- 푸터 = `git log --oneline -n 5` 실제 커밋 로그 톤
- 다크 디폴트, 라이트는 -700 hue 톤 + WCAG AA 통과

### 5. Editorial (The New Yorker · Medium · Apple 톤)

- **거대 번호 디스플레이 01/02/03/04** (`text-[12rem]`) — 01·04는 와인 컬러로 표지·뒤표지 메타포
- **세리프 헤딩** Playfair Display + Source Serif 본문 + Pretendard 한글 본문
- **Drop cap** 히어로 리드 문단 한 곳에만 (와인 5.25rem)
- **비대칭 7+5 / 5+7 그리드** — "feature spread" 매거진 느낌
- **Issue bar** "Vol. IX · Spring Issue · No.0009" + **colophon** 하단 (잡지 메타데이터)
- 액센트 와인 (`#722F37`) — 머스타드·올리브 후보 중 "읽는 즐거움" 정체성에 가장 부합
- 다크 = `#1a1816` 묵직한 차콜 + 페이퍼 화이트 텍스트

## 선택 가이드

| 선택 기준                                | 추천                   |
| :--------------------------------------- | :--------------------- |
| "프로젝트 자체의 완성도/엔지니어링 강조" | Minimalist · Tech-Dark |
| "학회 분위기/접근성 강조"                | Playful · Warm         |
| "포트폴리오/잡지처럼 보여주기"           | Editorial              |
| "한글 친화 + 따뜻함"                     | Warm                   |
| "B2B SaaS 톤"                            | Minimalist             |
| "엔지니어 채용 어필"                     | Tech-Dark              |

**믹스 OK**: "Warm 색감 + Minimalist 타이포" 같은 지시도 받음.

## 다음 단계

1. 5개 시안 브라우저로 열어서 비교 → 선택 (또는 믹스 지시)
2. 선택된 페르소나 + 믹스 가이드 → FE Engineer (실 구현)
3. `/design-review` (시각 QA) + `/qa` (기능 QA)
4. landing 배포 → `/canary` (라이브 모니터링)
