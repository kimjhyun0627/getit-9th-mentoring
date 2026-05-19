# GETIT 9기 멘토링 프로젝트

경북대학교 GETIT 동아리 9기 멘토링 프로젝트 모노레포.
4개 풀스택 웹 서비스 + 9기 허브 랜딩 + 통합 인증을 한 레포에서 개발/배포.

## 프로젝트

| 서비스 | URL | 설명 |
| :--- | :--- | :--- |
| 9기 허브 | [get-it.cloud](https://get-it.cloud) | 포트폴리오 랜딩 |
| 통합 SSO | [auth.get-it.cloud](https://auth.get-it.cloud) | 로그인/회원가입 |
| 🤲 취미메이트 | [hobby.get-it.cloud](https://hobby.get-it.cloud) | 학우 취미 매칭 |
| 📚 스마트 서재 | [shelf.get-it.cloud](https://shelf.get-it.cloud) | 책 검색·기록 |
| 💻 팀 칸반 | [board.get-it.cloud](https://board.get-it.cloud) | 칸반 보드 |
| 🎤 익명 롤링페이퍼 | [letter.get-it.cloud](https://letter.get-it.cloud) | 익명 메시지 보드 |

## 기술 스택

- **JavaScript** (TS 안 씀, JSDoc + Zod)
- **Frontend**: Vite + React + Tailwind + Zustand + TanStack Query + shadcn/ui
- **Backend**: Express + Prisma + MySQL + Zod + JWT
- **모노레포**: pnpm workspaces + Turborepo
- **배포**: GCP Compute Engine + Docker Compose + Traefik (Let's Encrypt)
- **CI/CD**: GitHub Actions + CodeRabbit

## 개발

```bash
# 사전 요구사항: Node 20, pnpm 9+

pnpm install
pnpm dev          # 모든 앱 hot-reload
pnpm test         # 전체 테스트
pnpm lint         # ESLint
pnpm build        # 모든 앱 빌드
```

## 컨트리뷰션

모든 변경은 **Issue → Branch → PR → Review → Merge** 사이클을 거친다.
자세한 컨벤션은 [`.claude/workflow.md`](.claude/workflow.md) 참고.

## 문서

- [`CLAUDE.md`](CLAUDE.md) — AI 협업 지침 (root)
- [`.claude/architecture.md`](.claude/architecture.md) — 아키텍처
- [`.claude/workflow.md`](.claude/workflow.md) — GitHub workflow + 컨벤션
- [`.claude/agents/`](.claude/agents/) — 멀티에이전트 운영
- [`.claude/projects/`](.claude/projects/) — 프로젝트별 spec

## 라이센스

[MIT](LICENSE)
