# 아키텍처

[← CLAUDE.md](../CLAUDE.md)

## 공통 원칙

- **JavaScript only** (TS 안 씀, JSDoc + Zod로 런타임 안전성 확보)
- **단일 모노레포**: pnpm workspaces + **Turborepo** (빌드 캐싱)
- 패키지 매니저: **pnpm**
- 모든 4 프로젝트 + landing + auth가 한 레포 안에 (apps/ + packages/ + infra/)
- **GitHub**: 사용자 개인 계정 (`kimjhyun0627`)에 단일 레포 (org 안 만듦)
- **레포 풀 경로**: `kimjhyun0627/getit-9th-mentoring`

## 모노레포 구조

```text
getit-9th/
├── apps/
│   ├── landing/              # get-it.cloud 루트 (9기 허브)
│   ├── auth-web/             # auth.get-it.cloud — 통합 로그인/회원가입 UI
│   ├── auth-api/             # auth.get-it.cloud/api — SSO BE (JWT 발급)
│   ├── hobby-web/            # hobby.get-it.cloud FE  (취미메이트, SSO)
│   ├── hobby-api/            # hobby.get-it.cloud/api BE
│   ├── shelf-web/            # shelf.get-it.cloud FE  (스마트 서재, SSO)
│   ├── shelf-api/            # shelf.get-it.cloud/api BE
│   ├── board-web/            # board.get-it.cloud FE  (칸반, SSO)
│   ├── board-api/            # board.get-it.cloud/api BE
│   ├── letter-web/           # letter.get-it.cloud FE  (롤링페이퍼, SSO로 부원 확인 + 익명)
│   └── letter-api/           # letter.get-it.cloud/api BE
├── packages/
│   ├── auth-utils/           # JWT 검증 미들웨어 + 클라이언트 훅 (5 앱 공유)
│   ├── theme/                # 다크모드 토글 + 시스템 detect (6 FE 공유)
│   ├── config-tailwind/      # Tailwind base + darkMode: 'class'
│   ├── config-eslint/        # ESLint 공통 (JS 모드)
│   └── schemas/              # Zod 스키마 + JSDoc typedef 공유
├── infra/
│   ├── docker-compose.dev.yml    # 로컬 dev (MySQL + 모든 앱)
│   ├── docker-compose.prod.yml   # GCP VM 배포용
│   └── traefik/                  # 리버스 프록시 + Let's Encrypt
├── .github/workflows/        # GitHub Actions (CI + 배포)
├── turbo.json
└── pnpm-workspace.yaml
```

**디자인 시스템 방침**: `packages/ui`는 두지 않음. 각 프로젝트가 자기 디자인 가짐.
shared는 `packages/theme` (다크모드)와 `packages/config-tailwind` (base 토큰)뿐.

## Frontend (6개 FE 앱 공통)

| 항목 | 선택 |
| :--- | :--- |
| 빌드 도구 | **Vite** |
| 프레임워크 | **React** |
| 스타일 | **Tailwind CSS** |
| 클라이언트 상태 | **Zustand** |
| 서버 상태 | **TanStack Query** |
| 컴포넌트 라이브러리 | **shadcn/ui** |
| 라우팅 | **React Router v6** |
| 폼 | **React Hook Form + Zod** |
| HTTP | **axios** |
| 테스트 | **Vitest + React Testing Library** |
| E2E 테스트 | **Playwright** |
| 에러 트래킹 | **Sentry** |
| 다크모드 | `packages/theme` (Zustand + matchMedia + localStorage) |

## Backend (5개 BE 앱 공통)

| 항목 | 선택 |
| :--- | :--- |
| 런타임 | Node.js (LTS) |
| 프레임워크 | **Express** |
| DB | **MySQL** |
| ORM | **Prisma** |
| 인증 | jsonwebtoken (JWT) |
| 비밀번호 해시 | bcrypt |
| 환경변수 | dotenv |
| CORS | cors |
| 보안 헤더 | **helmet** |
| Rate limit | **express-rate-limit** |
| 유효성 검사 | **Zod** (FE와 통일) |
| 로깅 | **pino + pino-http** |
| 테스트 | **Vitest + supertest** |
| API 도큐먼트 | **swagger-ui-express + zod-openapi** |
| 에러 트래킹 | **Sentry (@sentry/node)** |

## 코드 품질 도구

| 항목 | 선택 |
| :--- | :--- |
| Linter | ESLint (JS 모드) |
| Formatter | Prettier |
| Pre-commit | Husky + lint-staged |
| Commit message | Commitlint (Conventional Commits) |
| Type 안전성 | JSDoc + Zod 런타임 검증 |
| 파일 크기 | **150줄 권장 / 300줄 최대** (Code Reviewer 감시) |
| 테스트 방식 | **TDD 필수** (Red → Green → Refactor) |

## 도메인 매핑

| URL | 역할 | 인증 |
| :--- | :--- | :--- |
| `get-it.cloud` | 9기 멘토링 허브 (포트폴리오 랜딩) | 없음 |
| `auth.get-it.cloud` | 통합 SSO (회원가입/로그인/JWT 발급) | — |
| `hobby.get-it.cloud` | 취미메이트 (web + /api) | SSO |
| `shelf.get-it.cloud` | 스마트 서재 (web + /api) | SSO |
| `board.get-it.cloud` | 팀 칸반 (web + /api) | SSO |
| `letter.get-it.cloud` | 롤링페이퍼 (web + /api) | SSO (본인 글 식별용, 타인엔 익명) |

각 서브도메인은 web과 api를 같은 도메인 안에서: FE는 `/`, BE는 `/api/*`로 Traefik이 라우팅.
(CORS 회피 + 쿠키 same-origin)

## 통합 SSO 모델

- **공유 쿠키 도메인**: `.get-it.cloud` (HttpOnly, Secure, SameSite=Lax)
- 모든 서브도메인이 같은 JWT 인식
- 사용자 DB는 `auth-api`에 단일 (Users 테이블 하나)
- 각 프로젝트 BE는 `packages/auth-utils`의 JWT 검증 미들웨어로 토큰 확인
- 각 프로젝트의 도메인 데이터는 `user_id`만 참조 (사용자 정보는 auth가 관리)

## 롤링페이퍼 인증/익명 모델

- **SSO 로그인 필수** (GETIT 부원 확인용)
- 메시지 `Log` 테이블에 `author_id` 저장 (DB에는 비익명)
- **표시 정책**:
  - 다른 유저가 볼 때: 작성자 정보 완전 가림 (UI/API 응답 모두에서 노출 X)
  - 본인이 볼 때: "내 메시지" 표시 + 편집/삭제 버튼 노출
- 노션 PRD의 "4자리 비밀번호 삭제" 모델은 **폐기** (SSO 본인 인증으로 대체)
- BE 응답: `is_mine: boolean`만 보내고 author 식별자는 절대 노출 X

## 루트 페이지 (`apps/landing`)

GETIT 9기 멘토링 **포트폴리오 허브**:

- 9기 멘토링 소개
- 4개 프로젝트 카드 (스크린샷 + 한줄 설명 + 진입 버튼)
- 다크모드 토글 (우상단)
- 로그인 진입점 (`auth.get-it.cloud`로 리다이렉트)

## 다크모드 (`packages/theme`)

- **Tailwind**: `darkMode: 'class'` 전략
- **detect**: `window.matchMedia('(prefers-color-scheme: dark)')`로 시스템 설정 감지
- **state**: Zustand store (`useTheme`) + `localStorage` 영속화
- **토글**: `<ThemeToggle />` 컴포넌트 (6 FE 공통, 우상단 배치)
- **우선순위**: localStorage 저장값 → 시스템 설정 → light 기본값
- shadcn/ui는 `dark:` 클래스 기반이라 자연 호환

## Infra / DevOps

**배포 모델**: 단일 **GCP Compute Engine VM**에 **docker-compose 하나**로 모든 앱 + MySQL + Traefik 동시 실행. 사용자 도메인의 서브도메인으로 라우팅 (Traefik이 자동 HTTPS + 라우팅 처리).

```text
인터넷 → [GCP VM, 공인 IP]
              ↓ 80/443
         [Traefik] (Let's Encrypt 자동 SSL)
              ↓
   ┌──────┼──────┬──────┬──────┬──────┬──────┐
   ↓      ↓      ↓      ↓      ↓      ↓      ↓
landing  auth  hobby  shelf  board  letter mysql
```

| 항목 | 선택 |
| :--- | :--- |
| 컨테이너 | **Docker Compose** (모든 앱 + DB 단일 compose) |
| 클라우드 | **GCP Compute Engine** (단일 VM, **e2-medium**: 2vCPU/4GB, ~$25/월) |
| DB 호스팅 | docker-compose 내 MySQL 컨테이너 (volume mount로 영속화) |
| 리버스 프록시 / HTTPS | **Traefik** + Let's Encrypt (HTTP-01 챌린지, 서브도메인별 개별 인증서) |
| 도메인 | `get-it.cloud` (**가비아** 소유. 가비아 DNS에서 A 레코드 + 와일드카드 `*.get-it.cloud` → VM 정적 IP) |
| CI/CD | **GitHub Actions** (build → push Artifact Registry → SSH deploy) |
| 컨테이너 레지스트리 | GCP Artifact Registry |
| Secret 관리 | GitHub Secrets + .env (서버) (dev/prod 분리) |
| 에러 트래킹 | Sentry |
| 로그 | docker logs + journalctl + Sentry |
| 백업 | mysqldump cron → GCS bucket (주 1회) |
