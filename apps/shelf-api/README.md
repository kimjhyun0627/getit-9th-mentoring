# @getit/shelf-api

`shelf.get-it.cloud/api` — GETIT 9기 멘토링 **스마트 서재 BE**.

- 외부 도서 API 검색 중계(카카오/알라딘/네이버) + 응답 캐시
- 사용자별 서재(WANT/READING/READ) + 감상평 + 별점
- 통합 SSO `User.id(cuid)` 를 `userId` 로 받음(cross-DB, 앱 레벨 검증)

> 현재 작업 단계: **Issue #41 — 카카오 도서 API 중계 + Book 24h 캐시**
> Express 서버 + 검색/상세 엔드포인트. 서재 CRUD 는 후속 Issue #42 에서 추가.

## 빠른 시작

```bash
# 1. 의존성 설치 (모노레포 루트에서)
pnpm install

# 2. 환경 변수 준비
cp apps/shelf-api/.env.example apps/shelf-api/.env
# DATABASE_URL, 외부 API 키(후속) 채우기

# 3. Prisma Client 생성
pnpm --filter @getit/shelf-api prisma:generate

# 4. DB 마이그레이션 (로컬 MySQL 필요)
pnpm --filter @getit/shelf-api prisma:migrate

# 5. seed (더미 책 2권 + 서재 1건)
pnpm --filter @getit/shelf-api prisma:seed
```

## DB 스키마

### `Book` — 외부 API 응답 캐시

| 컬럼          | 타입            | 비고                                    |
| :------------ | :-------------- | :-------------------------------------- |
| `id`          | `String (cuid)` | PK                                      |
| `isbn`        | `String`        | unique. ISBN-10/13                      |
| `title`       | `String`        | 책 제목                                 |
| `author`      | `String`        | 저자(공동 저자는 콤마 결합)             |
| `publisher`   | `String`        | 출판사                                  |
| `publishedAt` | `DateTime?`     | 출판일(외부 API 누락 가능)              |
| `coverUrl`    | `String`        | 표지 이미지 URL                         |
| `description` | `Text?`         | 책 소개(긴 글 대응 Text)                |
| `source`      | `String`        | `kakao` / `aladin` / `naver` / `manual` |
| `cachedAt`    | `DateTime`      | `@updatedAt`. TTL 만료 인덱스 대상      |

인덱스: `isbn` (unique), `cachedAt` (캐시 만료 쿼리).

### `BookShelf` — 사용자별 책 보관 상태

| 컬럼          | 타입              | 비고                             |
| :------------ | :---------------- | :------------------------------- |
| `id`          | `String (cuid)`   | PK                               |
| `userId`      | `String`          | 통합 SSO `User.id`. 앱 레벨 검증 |
| `bookId`      | `String`          | FK → `Book.id`, onDelete Cascade |
| `status`      | `BookStatus enum` | `WANT` / `READING` / `READ`      |
| `rating`      | `Int?`            | 1~5 별점(앱 레벨 검증)           |
| `review`      | `Text?`           | 감상평                           |
| `addedAt`     | `DateTime`        | 서재 추가 시각(기본 now)         |
| `completedAt` | `DateTime?`       | 완독 시각(`READ` 전환 시)        |

인덱스: `@@unique([userId, bookId])`, `userId`, `bookId`.

## 설계 결정 메모

- **PK 타입**: cuid 문자열. auth-api와 일관.
- **cross-DB FK 미사용**: `userId` 는 auth-api `User.id` 를 가리키지만 DB 분리 가정.
  서비스 경계 보존 + 운영 시 schema 변경 자유도 확보. 무결성은 BE 미들웨어가
  토큰 검증 후 진행.
- **Book 캐시 TTL**: `cachedAt` 인덱스로 `WHERE cachedAt < now() - 24h` 쿼리 효율화.
  외부 API 응답 만료 정책은 BE(#41)에서 구현.
- **enum 도입**: `status` 는 `BookStatus` enum 으로 강제 — 오타/잘못된 값 차단.
- **description Text**: 외부 API description 이 1KB 넘는 경우 흔함 → `@db.Text`.
- **소프트 삭제 미사용**: 사용자가 서재에서 빼면 hard delete.

## API 엔드포인트

| Method | Path                   | 설명                                         |
| :----- | :--------------------- | :------------------------------------------- |
| GET    | `/api/health`          | 헬스체크 (public, no rate-limit)             |
| GET    | `/api/books/search?q=` | 카카오 도서 API 중계 + 결과 Book 으로 upsert |
| GET    | `/api/books/:isbn`     | 캐시 우선 (TTL 24h). 만료 시 외부 재호출     |

### 캐시 동작

- `Book.cachedAt` (Prisma `@updatedAt`) 가 TTL 시계.
- `/api/books/:isbn` 호출 시:
  - 신선 캐시 hit → 외부 호출 없이 즉시 응답 (`cached: true`)
  - 만료 + 외부 hit → 갱신 (`cached: false`)
  - 만료 + 외부 실패 → stale 캐시 반환 (`cached: true, stale: true`) — graceful degrade
  - 캐시 미스 + 외부 hit → upsert 후 응답
  - 캐시 미스 + 외부 miss → 404 `BookNotFound`
  - 캐시 미스 + 외부 실패 / 키 미설정 → 503 `ExternalApiUnavailable`

### 보안

- `KAKAO_BOOK_API_KEY` 는 **백엔드 .env 에만** 존재. FE 에 절대 노출 X.
- 외부 API 4xx (잘못된 키 등) 응답은 503 으로 마스킹 — 클라이언트가 키 상태를 추측 못 하게.
- helmet + CORS fail-closed (`CORS_ORIGINS` 비면 cross-origin 거부) + `/api/books` 라우터에 rate-limit.

## 환경 변수

`.env.example` 의 주석 참고. 핵심:

- `DATABASE_URL`: MySQL 접속
- `BOOK_CACHE_TTL_HOURS`: 외부 API 응답 캐시 TTL (기본 24)
- `KAKAO_BOOK_API_KEY`: 카카오 REST API 키. 절대 commit 금지.
- `CORS_ORIGINS`: 허용 origin 콤마 분리. 비우면 fail-closed.

## 스크립트

| 스크립트                | 설명                           |
| :---------------------- | :----------------------------- |
| `prisma:generate`       | Prisma Client 생성             |
| `prisma:migrate`        | dev 마이그레이션 실행          |
| `prisma:migrate:deploy` | prod 마이그레이션 적용         |
| `prisma:seed`           | 더미 책 2권 + 서재 1건 seed    |
| `prisma:studio`         | Prisma Studio (DB 브라우저)    |
| `lint`                  | `eslint src prisma`            |
| `test`                  | `vitest run --passWithNoTests` |

## 관련 문서

- spec: [`.claude/projects/shelf.md`](../../.claude/projects/shelf.md)
- 워크플로우: [`.claude/workflow.md`](../../.claude/workflow.md)
- 아키텍처: [`.claude/architecture.md`](../../.claude/architecture.md)
