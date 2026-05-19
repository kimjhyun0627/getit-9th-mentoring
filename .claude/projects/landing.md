# landing — 9기 멘토링 허브

[← CLAUDE.md](../../CLAUDE.md)

- **도메인**: `get-it.cloud`
- **앱**: `apps/landing/` (FE only)
- **인증**: 없음
- **추천 디자이너 페르소나**: Editorial, Minimalist

## 목적

9기 멘토링 프로젝트 4개를 보여주는 포트폴리오 허브.

## 핵심 요소

- GETIT 9기 멘토링 소개 (헤더/히어로)
- 4개 프로젝트 카드 — 스크린샷 + 한줄 설명 + 진입 버튼
  - 🤲 취미메이트 → `hobby.get-it.cloud`
  - 📚 스마트 서재 → `shelf.get-it.cloud`
  - 💻 팀 칸반 → `board.get-it.cloud`
  - 🎤 익명 롤링페이퍼 → `letter.get-it.cloud`
- 다크모드 토글 (우상단)
- 로그인 진입점 (`auth.get-it.cloud`로 리다이렉트)

## 기술 특이점

- 정적 페이지 위주 (Vite + React + Tailwind + shadcn)
- 백엔드 없음
- SEO 메타태그 필요 (OG image, description)
- 모바일 우선

## 우선순위 에이전트

Designer (×5) > FE Engineer > DevOps (배포)

## 노션 참고

루트 페이지: <https://knu-getit.notion.site/363694c484f780ca9ef2d0feeb53503b>
