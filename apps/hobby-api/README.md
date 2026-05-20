# @getit/hobby-api

`hobby.get-it.cloud/api` — GETIT 9기 **취미메이트** BE.

- 일회성 취미 모임 모집 게시글 CRUD
- 매칭 신청/취소 (정원 race condition 처리는 API 단)
- 매칭 완료 시 알림 + 오픈채팅 링크 공개

> 현재 단계: **Issue #33 — Prisma 스키마 + 초기 마이그레이션 + seed**
> Express API 코드는 후속 issue 에서 추가.

## 빠른 시작

```bash
# 1. 의존성 설치 (모노레포 루트)
pnpm install

# 2. 환경 변수 준비
cp apps/hobby-api/.env.example apps/hobby-api/.env

# 3. Prisma Client 생성
pnpm --filter @getit/hobby-api prisma:generate

# 4. DB 마이그레이션 (로컬 MySQL 필요)
pnpm --filter @getit/hobby-api prisma:migrate

# 5. seed (Tag 3개 + Post 1개)
pnpm --filter @getit/hobby-api prisma:seed
```

## DB 스키마 요약

| 모델           | 설명                                |
| :------------- | :---------------------------------- |
| `Post`         | 모집 게시글 (방장, 정원, 상태)      |
| `Tag`          | 태그 마스터 (name unique)           |
| `PostTag`      | Post ↔ Tag 다대다 조인              |
| `Application`  | 매칭 신청 (postId × userId unique)  |
| `Notification` | 알림 (kind 문자열, readAt nullable) |

상세는 `prisma/schema.prisma` 주석 참고.

## 설계 결정 메모

- **ownerId / userId FK 없음**: auth-api 와 DB 가 분리돼 있어 cross-DB FK 불가.
  cuid 문자열 (`User.id`) 만 저장하고 어플리케이션 레벨에서 검증.
- **PostStatus enum**: `RECRUITING / FULL / CLOSED` 3 상태로 단순화. 노쇼/제재는
  알림 + 별도 UserPenalty 테이블 (후속 issue) 에서 처리.
- **Notification.kind String**: enum 으로 강제하지 않음. 알림 종류 추가 시
  마이그레이션 부담 회피. 컨벤션은 BE 코드 상수로 관리.
- **Notification.postId nullable**: 게시글 삭제 후에도 알림 이력 보존.
  `onDelete: SetNull` 로 자동 처리.

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
| `prisma:seed`           | 더미 데이터 seed                          |
| `prisma:studio`         | Prisma Studio (DB 브라우저)               |

## 관련 문서

- 프로젝트 spec: [`.claude/projects/hobby.md`](../../.claude/projects/hobby.md)
- 아키텍처: [`.claude/architecture.md`](../../.claude/architecture.md)
- auth-api: [`apps/auth-api`](../auth-api)
