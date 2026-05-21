# infra — 공통 인프라

[← CLAUDE.md](../../CLAUDE.md)

- **앱**: `infra/`, `.github/workflows/`, 모노레포 root (`turbo.json`, `pnpm-workspace.yaml`)
- **인증**: 해당 없음 (인프라 레벨)
- **추천 디자이너 페르소나**: 해당 없음
- 자세한 아키텍처: [.claude/architecture.md](../architecture.md)
- 자세한 워크플로우: [.claude/workflow.md](../workflow.md)

## 책임 범위

모노레포 / Docker / Traefik / GCP / GitHub Actions / 도메인 / SSL — 모든 프로젝트의 공통 토대.

## 작업 단위 (Issue 분할 예시)

1. **모노레포 셋업** — pnpm workspace + Turborepo + 디렉토리 골격
2. **공유 패키지 부트스트랩** — `theme`, `auth-utils`, `config-tailwind`, `config-eslint`, `schemas`
3. **docker-compose.dev.yml** — 로컬 MySQL + 모든 앱 + hot reload
4. **docker-compose.prod.yml + Traefik** — 리버스 프록시 + Let's Encrypt + 라우팅 라벨
5. **GCP VM 프로비저닝** — Compute Engine, 방화벽, 정적 IP, SSH 키
6. **DNS 설정** — `get-it.cloud` + 와일드카드 → VM IP
7. **GitHub Actions CI** — lint + test + build (모든 PR 대상)
8. **GitHub Actions CD** — main 머지 시 Artifact Registry 푸시 + SSH 배포
9. **백업 cron** — mysqldump → GCS bucket
10. **모니터링** — Sentry 셋업, Cloud Logging 연동

## 🔥 핵심 챌린지

### Traefik 라벨 라우팅

각 앱 컨테이너에 docker labels로 라우팅 규칙 박기:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.hobby-web.rule=Host(`hobby.get-it.cloud`) && !PathPrefix(`/api`)"
  - "traefik.http.routers.hobby-api.rule=Host(`hobby.get-it.cloud`) && PathPrefix(`/api`)"
  - "traefik.http.routers.hobby-web.tls.certresolver=letsencrypt"
```

### docker-compose.prod의 환경분리

- `.env.dev` — 로컬용 (MySQL local, dummy secret)
- `.env.prod` — VM용 (GCP Secret Manager 또는 GitHub Secrets 주입)
- compose는 같은 파일 사용, env_file만 분리

### CI/CD 시간 최적화

- Turborepo 캐시 활용 (GitHub Actions cache)
- 변경된 앱만 빌드 (`turbo run build --filter=...`)
- 배포는 변경된 컨테이너만 푸시

### 비용 관리

- **e2-medium (2vCPU/4GB)**: 약 $25/월 (한국 리전 기준 변동)
- Cloud SQL 안 쓰니까 DB 비용 0 (대신 VM 디스크 확보)
- Artifact Registry storage: 무료 티어 안에서 운용
- GCS bucket (백업): 무료 티어 안에서
- 총 예상 비용: 월 $25-30 수준

### 도메인 / DNS 셋업 (가비아)

- **소유 업체**: 가비아 (`get-it.cloud`)
- **DNS 레코드**:
  - `A @ <VM IP>` (루트 = `get-it.cloud`)
  - `A * <VM IP>` (와일드카드 — 모든 서브도메인이 같은 VM 가리킴)
- **TTL**: 처음 셋업 시 300초 (테스트), 안정 후 3600초
- **SSL**: Let's Encrypt HTTP-01 챌린지 (Traefik 자동). 와일드카드 인증서가 아니라 각 서브도메인 개별 인증서 발급
- **메모**: 와일드카드 인증서가 필요하면 Cloudflare로 nameserver 이전 후 DNS-01 챌린지 사용 (현재는 불필요)

## 우선순위 에이전트

DevOps (압도적 H) > Security (인증/시크릿 관리) > Code Reviewer

## Auth 운영 검증 (Phase 8)

### Cross-domain 탈퇴 흐름 (#426)

정책: **탈퇴 = 즉시 4 도메인 자동 로그아웃**.

- `POST /api/me/delete` → `clearAuthCookies(res, cfg)` 가 `Set-Cookie ...; Domain=.get-it.cloud` 로 응답.
- 모든 서브도메인(hobby/shelf/board/letter/auth)의 access/refresh 쿠키가 즉시 클리어.
- DB 의 `User.deletedAt` 마킹 + 모든 `RefreshToken.revokedAt` 갱신.

Zombie session 한도:

- 4 프로젝트 BE 는 access JWT 검증만 (DB revoked-check 없음) → 다른 탭에서 사용 중이면 access TTL 동안 동작 가능.
- silent refresh 호출 시 `getit_refresh` 쿠키 이미 clear → `/api/refresh` 401 NoRefreshToken → FE interceptor 가 /login redirect (#456).
- 결론: **탈퇴 = 최대 access TTL (15분) 안에 모든 도메인 로그아웃 보장**.

검증 (수동):

```bash
# 1. 로그인 → access TTL 동안 4 도메인 동작 확인
# 2. /api/me/delete 호출 (auth.get-it.cloud)
# 3. 각 서브도메인 새로고침 → 401 (access TTL 만료 후) 또는 즉시 (쿠키 clear)
curl -i -b "getit_jwt=$JWT" https://hobby.get-it.cloud/api/health
```

follow-up (P3+): hobby/shelf/board/letter BE 에 `deletedAt` 가드 추가 — auth-api 의 `loadActiveUser` 패턴 이식 시 zombie window 0 초화.

### Prisma migration 라이브 검증 (#460)

Migrations:

- `20260519000000_init`
- `20260520000000_password_reset`
- `20260520120000_phase6c_user_profile_verify` (User.emailVerifiedAt, deletedAt, EmailVerifyToken)

검증 명령 (SSH 필요):

```bash
ssh -i ~/.ssh/getit_deploy jinhyun@34.64.104.92 \
  'docker exec getit-auth-api-1 npx -y prisma@6 migrate status'

# 신규 migration 추가 시 (CI 가 적용 안 함):
ssh -i ~/.ssh/getit_deploy jinhyun@34.64.104.92 \
  'docker exec getit-auth-api-1 npx -y prisma@6 migrate deploy'
```

라이브 sanity (signup 1회 → SMTP fallback):

```bash
ssh ... 'docker logs --since 5m getit-auth-api-1 | grep mailer-fallback'
```
