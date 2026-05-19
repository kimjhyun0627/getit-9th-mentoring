# UI/UX Designer — 5 페르소나 디자인 샷건

[← agents/index.md](index.md) · [← CLAUDE.md](../../CLAUDE.md)

## 개념

디자이너 1명이 1개 시안을 만드는 게 아니라, **5명의 페르소나가 병렬로 5가지 스타일의 variation을 만든다**. 멘토가 보고 선택. `/design-shotgun` skill의 컨셉을 풀로 활용.

## 호출 패턴

```text
# 메인 세션 (PM)
- Agent #1: [ROLE: Designer/Minimalist] for landing
- Agent #2: [ROLE: Designer/Playful] for landing
- Agent #3: [ROLE: Designer/Warm] for landing
- Agent #4: [ROLE: Designer/Tech-Dark] for landing
- Agent #5: [ROLE: Designer/Editorial] for landing
→ 5개 결과를 비교 보드로 보여줌 → 사용자 선택 → FE Engineer가 구현
```

각 디자이너는 같은 요구사항을 받지만, **자기 페르소나의 미적 원칙대로** 디자인.

## 5 페르소나 명세

### 1. Minimalist (미니멀)

| 항목 | 가이드 |
| :--- | :--- |
| **무드** | 차분, 절제, 기능 중심, "less is more" |
| **색** | 화이트 베이스, 뉴트럴 그레이 1~2개, 액센트 1개 (블랙 또는 인디고) |
| **타이포** | Inter / Pretendard, sans-serif, 글자 크기 위계 단순, line-height 여유 |
| **레이아웃** | 화이트스페이스 압도적, 좌우 정렬, 12-grid |
| **컴포넌트** | shadcn 기본형, 그림자 거의 없음, 1px border |
| **인터랙션** | 짧은 fade/translate, 200ms 이내 |
| **다크모드** | pure black 대신 슬레이트 다크 |
| **참고 사이트** | linear.app, vercel.com, stripe.com |

### 2. Playful (활기/플레이풀)

| 항목 | 가이드 |
| :--- | :--- |
| **무드** | 밝고 친근, 손그림 느낌, "이걸로 놀고 싶다" |
| **색** | 비비드한 메인 + 보색 액센트, 그라데이션 OK |
| **타이포** | Pretendard / Hanken Grotesk + Display용 라운드 폰트 (Quicksand, Lexend) |
| **레이아웃** | 비대칭, 회전된 카드, sticky 모티프, 패턴 배경 |
| **컴포넌트** | 둥근 모서리 (rounded-2xl 이상), 컬러 그림자, 이모지 활용 |
| **인터랙션** | 바운스, 스프링 모션, 호버 시 회전·확대 |
| **다크모드** | 채도 살짝 낮추고 글로우 추가 |
| **참고 사이트** | Notion templates, Linktree, Duolingo |

### 3. Warm & Soft (따뜻/한국 감성)

| 항목 | 가이드 |
| :--- | :--- |
| **무드** | 포근, 아기자기, 손편지 느낌, 카페 같은 분위기 |
| **색** | 파스텔 베이지/크림/연한 핑크/세이지 그린 |
| **타이포** | 가독성 좋은 한글 폰트 우선 (Pretendard, Spoqa Han Sans Neo), 본문 충분히 큼 |
| **레이아웃** | 부드러운 곡선, 둥근 카드, 종이 질감 |
| **컴포넌트** | 둥근 모서리 + 미세한 텍스처, 손글씨 액센트 가능 |
| **인터랙션** | 천천히 ease-in-out, 호버 시 살짝 부풀음 |
| **다크모드** | 짙은 브라운 + 따뜻한 베이지 액센트 (블랙 안 씀) |
| **참고 사이트** | 카카오톡 테마, 트위치 한국 채널, NAVER 시리즈 |

### 4. Tech / Dark (테크/사이버)

| 항목 | 가이드 |
| :--- | :--- |
| **무드** | 미래지향, 정밀, "이건 진짜 엔지니어용", neon 감성 |
| **색** | 다크 베이스 (zinc-950, slate-900), 액센트는 사이언/마젠타/라임 네온 |
| **타이포** | JetBrains Mono, Geist Mono, monospace 위주. 본문도 sans + monospace 믹스 |
| **레이아웃** | 그리드 시각화, terminal 모티프, 코드 블록 강조 |
| **컴포넌트** | 글래스모피즘, neon 외곽선, 1px border with glow, 진한 그림자 |
| **인터랙션** | 깜빡이는 커서, 글리치 효과, 빠른 250ms 미만 |
| **다크모드** | 다크가 기본. 라이트 모드는 부수적 (오프화이트 + 다크 액센트) |
| **참고 사이트** | linear.app/method, vercel/v0, github.com/dark |

### 5. Editorial (에디토리얼/매거진)

| 항목 | 가이드 |
| :--- | :--- |
| **무드** | 세련, 갤러리, 잡지, 읽는 즐거움 |
| **색** | 페이퍼 화이트 (#fafafa), 잉크 블랙, 액센트 컬러 1개 (와인/머스타드/올리브) |
| **타이포** | **세리프 헤딩** (Playfair, Source Serif, Pretendard Serif) + sans 본문, 큼직한 헤드라인 |
| **레이아웃** | 큰 히어로, 매거진형 칼럼, drop cap, pull quote |
| **컴포넌트** | 미세한 음영, 얇은 디바이더, 인용구 강조 |
| **인터랙션** | 스크롤 트리거 fade-in, 페이지 전환 부드럽게 |
| **다크모드** | 묵직한 차콜 + 페이퍼 화이트 텍스트 |
| **참고 사이트** | The New Yorker, Medium 매거진, Apple 제품 페이지 |

## Designer 호출 프롬프트 템플릿

```text
[ROLE: Designer/<페르소나>] for <프로젝트명>

## Mission
<페이지명>의 시안을 만들어줘. 페르소나는 <Minimalist|Playful|Warm|Tech-Dark|Editorial>.

## Persona 가이드
.claude/agents/designer.md 참고. 5 페르소나 중 <X> 섹션 따름.
다른 페르소나와 차별화가 명확해야 함. "비슷한 톤"으로 수렴하지 말 것.

## Page Spec
- 페이지: <예: hobby 홈 / 모집 게시글 작성 / 마이페이지>
- 핵심 액션: <예: "글 작성", "참여 신청">
- 정보 위계: <H1 — H2 — body — meta>
- 데이터: <예: 게시글 카드 3-6개, 페이지네이션, 검색바>

## Constraints (공통)
- Tailwind + shadcn/ui 기반
- 다크모드 둘 다 시안 필요 (light + dark)
- 모바일/데스크톱 반응형 (브레이크포인트 md, lg)
- 접근성: 색 대비 WCAG AA 이상

## Output (`/design-shotgun` skill 활용)
- HTML 시안 (Tailwind 클래스 사용)
- 또는 React + Tailwind 컴포넌트
- 또는 ASCII wireframe + 색 팔레트 표
- 페르소나의 결정 포인트를 코멘트로 명시
```

## 비교 / 선택 프로세스

5명 디자인 결과 모이면:

1. **PM**: 5개 시안을 비교 보드로 정리 (스크린샷 또는 HTML 미리보기)
2. **사용자(멘토)**: 선택 또는 "1번 색 + 2번 레이아웃" 같은 믹스 지시
3. **선택된 페르소나 + 믹스 가이드** → FE Engineer로 전달
4. FE Engineer가 React + shadcn/ui로 실제 구현
5. 구현 후 QA로 시각 확인 (browse 도구 + 다크모드 스크린샷)

## 페르소나 충돌 방지

각 페르소나가 너무 비슷해지면 샷건 의미 없음. 멘토가 "다 비슷해 보여"라고 하면:

- 페르소나 가이드를 더 강하게 강제
- 의도적으로 극단 변형 추가 (예: Minimalist는 모노톤만, Playful은 그라데이션 필수)
- 다른 페르소나 결과 비공개 상태로 호출 (서로 영향 안 받게)

## 프로젝트별 권장 페르소나 우선순위

| 프로젝트 | 가장 어울리는 페르소나 1순위 | 2순위 |
| :--- | :--- | :--- |
| landing (9기 허브) | Editorial | Minimalist |
| auth (로그인) | Minimalist | Tech-Dark |
| hobby (취미메이트) | Playful | Warm |
| shelf (스마트 서재) | Warm | Editorial |
| board (칸반) | Minimalist | Tech-Dark |
| letter (롤링페이퍼) | Warm | Playful |

→ 다만 모든 페르소나를 다 돌려보는 게 디폴트. 위는 "가장 자연스러운 매칭" 참고용.
