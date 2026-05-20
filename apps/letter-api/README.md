# @getit/letter-api

`letter.get-it.cloud/api` — GETIT 9기 멘토링 **익명 롤링페이퍼 BE**.

- 단일 `Message` 테이블 (포스트잇 4색)
- 작성자 검증은 auth-api JWT의 `sub` 클레임으로 (`authorId === sub`)
- 익명성: API 응답에 `authorId` 절대 노출 X. `isMine: boolean` 으로만 본인 식별

> 현재 작업 단계: **Issue #51 — Prisma 스키마 + 초기 마이그레이션 + seed**
> Express 서버 / API 라우트는 후속 Issue (#52, #53) 에서 추가.

## 빠른 시작

```bash
# 1. 의존성 설치 (모노레포 루트에서)
pnpm install

# 2. 환경 변수 준비
cp apps/letter-api/.env.example apps/letter-api/.env
# DATABASE_URL 채우기

# 3. Prisma Client 생성
pnpm --filter @getit/letter-api prisma:generate

# 4. DB 마이그레이션 (로컬 MySQL 필요)
pnpm --filter @getit/letter-api prisma:migrate

# 5. seed (더미 메시지 5개)
pnpm --filter @getit/letter-api prisma:seed
```

## DB 스키마

### `Message` — 익명 롤링페이퍼 메시지

| 컬럼        | 타입            | 비고                                                 |
| :---------- | :-------------- | :--------------------------------------------------- |
| `id`        | `String (cuid)` | PK                                                   |
| `authorId`  | `String`        | auth-api `User.id` 참조 (cross-DB라 FK는 X, index O) |
| `content`   | `Text`          | 메시지 본문 (길이 제한은 BE Zod에서 강제)            |
| `color`     | `MessageColor`  | enum: `PINK \| MINT \| LEMON \| LAVENDER`            |
| `createdAt` | `DateTime`      | 자동                                                 |
| `updatedAt` | `DateTime`      | 자동                                                 |

인덱스: `createdAt` (목록 정렬용), `authorId` (본인 검증 쿼리용).

## 설계 결정 메모

- **PK 타입**: cuid 문자열. 분산 환경 충돌 없고 정렬 가능. auth-api와 동일 컨벤션.
- **authorId 컬럼**:
  - DB에는 **반드시** 저장 (본인 검증 + 본인 메시지 식별).
  - 외부 응답 매핑에서는 **절대** 노출 X. BE 응답 DTO에서 `select` 강제 또는 명시적
    매핑으로 제거. → 이 PR은 schema 범위만. BE 검증은 sub #52/#53.
  - cross-DB FK는 미사용. auth-api와 letter-api가 같은 MySQL 인스턴스라도
    별도 schema/DB로 운용 가능하게 String 컬럼만 둠.
- **color enum**: 4색 고정. FE 화이트보드 그리드의 포스트잇 색상.
- **인덱스 최소**: `createdAt` (목록 정렬), `authorId` (본인 검증). content 검색 미지원.
- **소프트 삭제 미사용**: 9기 멘토링 스코프에선 hard delete 충분.

## 환경 변수

`.env.example` 참고. 핵심:

- `DATABASE_URL`: MySQL 접속 (dev는 localhost, prod는 docker-compose 내부 네트워크)
- `PORT`: 기본 3005 (auth=3001, hobby=3002, shelf=3003, board=3004, letter=3005)
- `NODE_ENV`: development | production

## 스크립트

| 스크립트                | 설명                                      |
| :---------------------- | :---------------------------------------- |
| `dev`                   | `node --watch src/server.js` (hot reload) |
| `start`                 | prod 실행                                 |
| `test`                  | `vitest run`                              |
| `lint`                  | `eslint src prisma`                       |
| `prisma:generate`       | Prisma Client 생성                        |
| `prisma:migrate`        | dev 마이그레이션 실행                     |
| `prisma:migrate:deploy` | prod 마이그레이션 적용                    |
| `prisma:seed`           | 더미 메시지 seed                          |
| `prisma:studio`         | Prisma Studio (DB 브라우저)               |

## 관련 문서

- spec: [`/.claude/projects/letter.md`](../../.claude/projects/letter.md)
- 아키텍처: [`/.claude/architecture.md`](../../.claude/architecture.md)
- auth-api Prisma 패턴 (참조): [`apps/auth-api/`](../auth-api/)
