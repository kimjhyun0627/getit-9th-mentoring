# @getit/board-api

`board.get-it.cloud/api` — GETIT 9기 멘토링 **팀 칸반 BE**.

- Project / ProjectMember / BoardColumn / Card 5 테이블 (User는 auth-api 공유)
- 권한 검증: ProjectMember 기반 — 모든 컬럼/카드 API에서 403 Forbidden 처리 (#46~)
- 카드/컬럼 이동: between-keys 알고리즘 (order Float, prev/next 평균)

> 현재 작업 단계: **Issue #45 — Prisma 스키마 + 초기 마이그레이션 + seed**
> Express 서버 / 라우트는 후속 Issue #46/#47/#48 에서 추가.

## 빠른 시작

```bash
# 1. 의존성 설치 (모노레포 루트에서)
pnpm install

# 2. 환경 변수 준비
cp apps/board-api/.env.example apps/board-api/.env
# DATABASE_URL, SEED_OWNER_ID, SEED_MEMBER_ID 채우기

# 3. Prisma Client 생성
pnpm --filter @getit/board-api prisma:generate

# 4. DB 마이그레이션 (로컬 MySQL 필요)
pnpm --filter @getit/board-api prisma:migrate

# 5. seed (프로젝트 1개 + 멤버 + 컬럼 3개 + 카드 2개)
#    auth-api seed 먼저 실행 → alice/bob id를 SEED_OWNER_ID/SEED_MEMBER_ID 로 주입
pnpm --filter @getit/board-api prisma:seed
```

## DB 스키마

### `Project` — 칸반 프로젝트

| 컬럼          | 타입            | 비고                         |
| :------------ | :-------------- | :--------------------------- |
| `id`          | `String (cuid)` | PK                           |
| `ownerId`     | `String`        | auth-api `User.id` 논리적 FK |
| `name`        | `String`        | 표시 이름                    |
| `description` | `String? Text`  | 긴 설명 (옵션)               |
| `createdAt`   | `DateTime`      | 자동                         |
| `updatedAt`   | `DateTime`      | 자동                         |

### `ProjectMember` — 멤버십 + 권한

| 컬럼        | 타입             | 비고                                |
| :---------- | :--------------- | :---------------------------------- |
| `id`        | `String (cuid)`  | PK                                  |
| `projectId` | `String`         | FK → `Project.id`, onDelete Cascade |
| `userId`    | `String`         | auth-api `User.id` 논리적 FK        |
| `role`      | `OWNER`/`MEMBER` | enum                                |
| `joinedAt`  | `DateTime`       | 자동                                |

unique: `(projectId, userId)` — 한 유저는 한 프로젝트에서 한 역할.

### `BoardColumn` — Todo / Doing / Done

| 컬럼        | 타입            | 비고                                |
| :---------- | :-------------- | :---------------------------------- |
| `id`        | `String (cuid)` | PK                                  |
| `projectId` | `String`        | FK → `Project.id`, onDelete Cascade |
| `name`      | `String`        | 컬럼 이름                           |
| `order`     | `Float`         | between-keys 정렬 키                |

index: `(projectId, order)`.

### `Card` — 칸반 카드

| 컬럼          | 타입            | 비고                                    |
| :------------ | :-------------- | :-------------------------------------- |
| `id`          | `String (cuid)` | PK                                      |
| `columnId`    | `String`        | FK → `BoardColumn.id`, onDelete Cascade |
| `title`       | `String`        | 카드 제목                               |
| `description` | `String? Text`  | 긴 본문 (옵션)                          |
| `assigneeId`  | `String?`       | 담당자 (auth-api User.id, null=미배정)  |
| `order`       | `Float`         | between-keys 정렬 키                    |
| `createdAt`   | `DateTime`      | 자동                                    |
| `updatedAt`   | `DateTime`      | 자동                                    |

index: `(columnId, order)`, `assigneeId`.

## 설계 결정 메모

- **User FK 논리적 처리**: auth-api 와 같은 MySQL 인스턴스라도 DB 스키마 분리 가능성을
  고려해 physical FK 대신 `String` 컬럼 + 인덱스만 둠. 권한 검증은 BE 미들웨어 (#46) 책임.
- **between-keys order**: Float 타입. 이동 시 `(prev.order + next.order) / 2` 부여 →
  주변 카드 재정렬 비용 없음. 같은 자리에 1000회 이상 끼우면 정밀도 손실 가능 — 후속
  rebalance 작업은 별도 이슈로 분리.
- **cascade delete**: Project 삭제 시 멤버/컬럼/카드 자동 정리. 카드 → 컬럼 → 프로젝트
  3단 cascade chain.
- **enum MemberRole**: OWNER/MEMBER 2단계. 추후 ADMIN/VIEWER 확장 여지.

## 환경 변수

`.env.example` 참고. seed 실행 시 `SEED_OWNER_ID` (필수) / `SEED_MEMBER_ID` (옵션) 필요.

## 스크립트

| 스크립트                | 설명                           |
| :---------------------- | :----------------------------- |
| `test`                  | `vitest run` (현재는 schema만) |
| `lint`                  | `eslint src prisma`            |
| `prisma:generate`       | Prisma Client 생성             |
| `prisma:migrate`        | dev 마이그레이션 실행          |
| `prisma:migrate:deploy` | prod 마이그레이션 적용         |
| `prisma:seed`           | 더미 프로젝트/카드 seed        |
| `prisma:studio`         | Prisma Studio (DB 브라우저)    |

## 관련 문서

- spec: [`/.claude/projects/board.md`](../../.claude/projects/board.md)
- 워크플로우: [`/.claude/workflow.md`](../../.claude/workflow.md)
- auth-api: [`../auth-api/`](../auth-api/) (User 단일 소스)
