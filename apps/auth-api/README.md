# @getit/auth-api

`auth.get-it.cloud/api` — GETIT 9기 멘토링 **통합 SSO BE**.

- 5개 BE 앱(hobby/shelf/board/letter + 본인)이 공유하는 단일 Users 테이블
- JWT 발급/검증 + refresh token 회전
- 쿠키 도메인 `.get-it.cloud` 로 모든 서브도메인에서 SSO

> 현재 작업 단계: **Issue #9 — Prisma 스키마 + 초기 마이그레이션 + seed**
> Express 서버 코드는 후속 Issue #10에서 추가.

## 빠른 시작

```bash
# 1. 의존성 설치 (모노레포 루트에서)
pnpm install

# 2. 환경 변수 준비
cp apps/auth-api/.env.example apps/auth-api/.env
# DATABASE_URL, JWT_SECRET 등 채우기

# 3. Prisma Client 생성
pnpm --filter @getit/auth-api prisma:generate

# 4. DB 마이그레이션 (로컬 MySQL 필요)
pnpm --filter @getit/auth-api prisma:migrate

# 5. seed (더미 유저 2명)
pnpm --filter @getit/auth-api prisma:seed

# 6. dev 서버 (Issue #10 머지 후)
pnpm --filter @getit/auth-api dev
```

## DB 스키마

### `User` — 통합 SSO 사용자

| 컬럼           | 타입            | 비고                    |
| :------------- | :-------------- | :---------------------- |
| `id`           | `String (cuid)` | PK. 다른 BE가 FK로 참조 |
| `email`        | `String`        | unique + index          |
| `passwordHash` | `String`        | bcrypt cost 12          |
| `name`         | `String`        | 표시 이름 (40자 이내)   |
| `createdAt`    | `DateTime`      | 자동                    |
| `updatedAt`    | `DateTime`      | 자동                    |

### `RefreshToken` — JWT 회전용

| 컬럼        | 타입            | 비고                                           |
| :---------- | :-------------- | :--------------------------------------------- |
| `id`        | `String (cuid)` | PK                                             |
| `userId`    | `String`        | FK → `User.id`, onDelete Cascade               |
| `tokenHash` | `String`        | 평문 refresh token의 **SHA-256 해시** (unique) |
| `expiresAt` | `DateTime`      | 보통 발급 시점 + 30일                          |
| `revokedAt` | `DateTime?`     | 로그아웃/회전 시 마킹                          |
| `createdAt` | `DateTime`      | 자동                                           |

인덱스: `userId`, `tokenHash`.

## 설계 결정 메모

- **PK 타입**: cuid (문자열). 분산 환경에서 충돌 없고 정렬 가능. 다른 BE 앱이
  `user_id VARCHAR(191)` 로 받기 편함.
- **Refresh token 저장 방식**: 평문이 아닌 SHA-256 해시 저장. DB 유출 시
  토큰 재사용 방지. 발급 시 BE가 hash 비교로 검증.
- **bcrypt cost 12**: 2026년 기준 권장값. 회원가입 ~250ms 비용 vs 무차별
  대입 비용. 환경변수 `BCRYPT_COST` 로 조정 가능.
- **JwtPayload 호환**: `sub === User.id` (cuid 문자열). `@getit/schemas/auth`
  의 `JwtPayload.sub: z.string()` 과 일치.
- **소프트 삭제 미사용**: 9기 멘토링 스코프에선 사용자 hard delete 으로 충분.

## 환경 변수

`.env.example` 의 주석 참고. 핵심:

- `DATABASE_URL`: MySQL 접속 (dev는 localhost, prod는 docker-compose 내부 네트워크)
- `JWT_SECRET`: 32자 이상. prod는 절대 commit 금지
- `JWT_EXPIRES_IN`: access token TTL (기본 7d)
- `JWT_REFRESH_EXPIRES_IN`: refresh token TTL (기본 30d)
- `COOKIE_DOMAIN`: `.get-it.cloud` (모든 서브도메인 공유)
- `COOKIE_SECURE`: dev `false`, prod `true`
- `CORS_ORIGINS`: 콤마 분리 FE 도메인 목록

## 스크립트

| 스크립트                | 설명                                      |
| :---------------------- | :---------------------------------------- |
| `dev`                   | `node --watch src/server.js` (hot reload) |
| `start`                 | prod 실행                                 |
| `test`                  | `vitest run`                              |
| `lint`                  | `eslint src`                              |
| `prisma:generate`       | Prisma Client 생성                        |
| `prisma:migrate`        | dev 마이그레이션 실행                     |
| `prisma:migrate:deploy` | prod 마이그레이션 적용                    |
| `prisma:seed`           | 더미 유저 seed                            |
| `prisma:studio`         | Prisma Studio (DB 브라우저)               |

## 관련 문서

- 아키텍처: [`/.claude/architecture.md`](../../.claude/architecture.md)
- 공유 스키마: [`packages/schemas/src/auth.js`](../../packages/schemas/src/auth.js)
- JWT 미들웨어: [`packages/auth-utils/src/server.js`](../../packages/auth-utils/src/server.js)
