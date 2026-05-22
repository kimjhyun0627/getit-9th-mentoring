# school-auth — 학교 인증 + 닉네임 + 학번

[← CLAUDE.md](../../CLAUDE.md)

- **스코프**: 전 앱 공통 (auth-api / auth-web 주역, hobby 가드 적용)
- **대상 도메인**: `auth.get-it.cloud`, `hobby.get-it.cloud`
- **연관 앱**: `apps/auth-api`, `apps/auth-web`, `apps/hobby-api`, `apps/hobby-web`, 기타 `*-web` (nickname onboarding)
- **난이도**: ⭐⭐⭐⭐
- **추천 디자이너 페르소나**: Tech-Dark (auth 통일), Playful (hobby 가드 안내)

## 배경 / 목표

hobby PRD (`projects/hobby.md`) 와 ERD에 명시된 "학번 / 학교 이메일 인증"이 현재 SSO 스키마에는 빠져 있다 (P1 gap). 회원가입은 외부 메일 (예: `@gmail.com`) 도 허용되는 상태라, 학회 행사 매칭(취미메이트)에 외부인이 섞일 수 있다.

이번 작업의 목표:

1. **닉네임을 SSO 1급 필드로 승격** — 신규/기존 양쪽 강제, 표시 우선순위 `nickname > name (fallback)`.
2. **학교 메일(`@knu.ac.kr`) 인증 흐름 추가** — 토큰 메일 → 학번 입력 → `schoolVerifiedAt` 셋.
3. **hobby 의 핵심 액션(모집글/신청)을 학교 인증 사용자로 제한** — 학회 행사의 학교 한정 성격 유지. shelf/board/letter는 외부인 사용 가능 그대로.

## 비즈니스 결정 (PM 합의 완료)

- 외부인 가입 자체는 막지 않는다. shelf(독서), board(칸반), letter(롤링페이퍼) 까지는 학회 외 친구도 초대해서 쓸 수 있다.
- hobby 의 모집/신청만 학교 인증 사용자로 제한. **기존 외부인 가입자는 hobby lockout 위험** — 마이그레이션 정책으로 안내.
- 학교 인증 메일은 **기존 Gmail SMTP 재활용**. 일일 500건 제한 안에 학교 인증 트래픽은 충분히 들어옴 (예상 < 100/일).
- 닉네임은 신규 가입에서 required, 기존 계정은 다음 로그인 시 onboarding 강제 (skip 불가).

## 사용자 시나리오

### 1) 신규 학회 가입자

1. 회원가입 폼 → email + password + name + **nickname (required)** → 가입 완료 + 이메일 인증 메일 발송 (기존 흐름)
2. 로그인 → 마이페이지 → "학교 계정 연동" 카드 → 학교 메일 (`@knu.ac.kr`) 입력 → 인증 메일 발송
3. 메일 링크 클릭 → `/verify-school?token=...` → **학번 8자리 입력 폼** → 검증 + 저장 → `schoolVerifiedAt` 셋 → 학교 인증 뱃지 표시
4. hobby 모집글 작성 / 신청 가능

### 2) 기존 외부인 가입자 (이미 운영 중인 가입자)

1. 다음 로그인 시 `nickname == null` 감지 → **SetupNickname onboarding 페이지로 forced redirect** (skip 불가)
2. 닉네임 설정 완료 → 정상 서비스 사용 가능 (shelf/board/letter/landing 모두 OK)
3. hobby 들어가면 "모집 글 만들기" 버튼 `disabled` + 마이페이지 학교 인증 권유 카피
4. 마이페이지에서 학교 메일 인증 진행하면 hobby 사용 가능 (위 1)의 2번 흐름과 동일)
5. 학교 인증 없이는 hobby 모집/신청 영구 차단 — lockout 명시

### 3) 인증 토큰 만료 / 재발송

- 토큰 TTL 30분, 1회용
- 분당 3건 / 유저 rate limit (스팸 방지)
- 토큰 만료 시 사용자에게 "재발송" 버튼 노출

## 데이터 모델 (auth-api/prisma)

기존 `User` 모델 확장 + `SchoolVerifyToken` 신규.

```prisma
model User {
  // ... 기존 필드
  nickname          String?    @unique  // 마이그레이션 단계에선 nullable, 강제 onboarding 후 not-null 화 (Phase 10.5)
  studentId         String?              // 8자리 숫자, 학교 인증 흐름 안에서만 채워짐
  schoolEmail       String?    @unique   // @knu.ac.kr 도메인 강제, 검증 후 저장
  schoolVerifiedAt  DateTime?            // 학교 인증 완료 시각
  schoolVerifyTokens SchoolVerifyToken[]
}

/// 학교 메일 인증 1회용 토큰.
/// - signup 후 마이페이지에서 발급, 30분 TTL.
/// - tokenHash: SHA-256(평문 토큰). 평문은 절대 저장 X.
/// - email: 인증 대상 학교 메일 (@knu.ac.kr).
/// - consumedAt: 사용된 시각 (null = 미사용).
/// - 사용 시 User.schoolEmail / schoolVerifiedAt 채우고 토큰 consumed 마킹.
model SchoolVerifyToken {
  id          String    @id @default(cuid())
  userId      String
  email       String
  tokenHash   String    @unique
  expiresAt   DateTime
  consumedAt  DateTime?
  createdAt   DateTime  @default(now())
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

### 마이그레이션 단계

| 단계 | 작업 | 영향 |
| :--- | :--- | :--- |
| 1 | `ALTER TABLE User ADD COLUMN nickname VARCHAR(20) NULL UNIQUE` 등 컬럼 추가 | 기존 row 영향 없음 |
| 2 | `SchoolVerifyToken` 테이블 생성 | 신규 테이블 |
| 3 | (Phase 10 종료 후) 모든 활성 유저가 nickname 설정 완료 후 `NOT NULL` 제약 부여 — **별도 PR로 분리** | 운영 후 안전하게 |

> PM 결정 필요: **`NOT NULL` 강제 시점** — 일정 기간(예: 2주) 후 자동? 또는 활성 유저 100% nickname 보유 확인 후 수동?

## API 변경

### auth-api

| Method | Path | 설명 | 변경 |
| :--- | :--- | :--- | :--- |
| POST | `/api/auth/signup` | 회원가입 | **nickname required**, Zod 스키마 갱신, unique 충돌 처리 |
| POST | `/api/me/school-link` | 학교 메일 입력 + 토큰 발송 | **신규**. `@knu.ac.kr` 검증, SchoolVerifyToken row 생성, Gmail SMTP 발송 |
| POST | `/api/auth/verify-school` | 토큰 + 학번 검증 → 저장 | **신규**. `{ token, studentId }` 받음, 토큰 1회 소진, `schoolVerifiedAt` 셋 |
| POST | `/api/me/school-link/resend` | 인증 메일 재발송 | **신규**. 분당 3건 rate limit |
| PATCH | `/api/me/profile` | 닉네임 변경 | **확장**. studentId / schoolEmail 은 이 API로 변경 불가 (학교 인증 흐름 전용) |
| GET | `/api/me` | 현재 사용자 정보 | **확장**. `nickname, studentId, schoolEmail, schoolVerifiedAt` 추가 |

응답 예시 (`GET /api/me`):

```json
{
  "id": "ckxyz...",
  "email": "user@gmail.com",
  "name": "홍길동",
  "nickname": "길동이",
  "studentId": "20241234",
  "schoolEmail": "user@knu.ac.kr",
  "schoolVerifiedAt": "2026-05-21T10:00:00Z",
  "emailVerifiedAt": "2026-05-19T12:00:00Z"
}
```

### hobby-api 가드

| Method | Path | 가드 동작 |
| :--- | :--- | :--- |
| POST | `/api/posts` | `schoolVerifiedAt == null` 이면 403 `{ error: 'SchoolVerificationRequired', message: '학교 인증이 필요합니다.' }` |
| POST | `/api/applications` | 같은 가드 |
| GET | (조회 계열) | 가드 X — 외부인도 hobby 둘러보기는 가능 |

> PM 결정 필요: **조회 자체도 차단할지** — 본 PRD 디폴트는 "조회 OK, 액션만 차단" (둘러보고 가입 동기 부여).

## 닉네임 정책

| 항목 | 정책 |
| :--- | :--- |
| 길이 | 2 ~ 20 자 |
| 허용 문자 | 한글 / 영문 / 숫자 / `-` / `_` |
| 정규식 | `^[가-힣a-zA-Z0-9_-]{2,20}$` |
| 유일성 | **case-insensitive unique** (DB 저장 시 원본 보존 + `nicknameLower` 인덱스 필요 시 추가 — PM 결정) |
| 변경 가능 여부 | 가능 — cooldown 정책은 옵션 (PM 결정) |
| 표시 우선순위 | `nickname` > `name` (fallback) |
| 금칙어 | `admin`, `getit`, `운영자`, `관리자` 등 기본 deny-list (PM 결정 필요) |

> PM 결정 필요:
>
> - case-insensitive unique 구현 방법 — MySQL collation (`utf8mb4_unicode_ci`) 활용 vs 별도 `nicknameLower` 컬럼?
> - 변경 cooldown — 무제한? 30일? 시즌제?
> - 금칙어 목록 확정

## 학번 정책

| 항목 | 정책 |
| :--- | :--- |
| 형식 | 8자리 숫자 `^\d{8}$` (예: `20241234`) |
| 유일성 | unique 강제 **X** (재입학 / 복수 학번 케이스) |
| 입력 시점 | 학교 메일 인증 흐름의 학번 입력 폼에서만 |
| 변경 가능 여부 | 학교 인증 다시 받으면 갱신 (단순 PATCH X) |

> Out of scope: 실제 학교 학적 DB 연동 (KNU 포털 OAuth 등) — 본 PRD 범위 밖. 메일 도메인 검증 + 자발적 학번 입력으로 1차 처리.

## 학교 인증 흐름

```
[마이페이지] 학교 계정 연동 카드
    ↓ (학교 메일 입력: foo@knu.ac.kr)
[POST /api/me/school-link]
    ├─ 도메인 검증 (@knu.ac.kr 아니면 400)
    ├─ rate limit (분당 3건/유저)
    ├─ SchoolVerifyToken row 생성 (TTL 30분, tokenHash 저장)
    └─ Gmail SMTP 로 인증 메일 발송
        ↓ (메일 안 링크 클릭)
[/verify-school?token=XYZ]  ← auth-web 페이지
    ├─ 토큰 유효성 즉시 확인 (만료/소진/없음 → 에러 페이지)
    └─ 학번 입력 폼 노출
        ↓ (학번 8자리 입력 + 제출)
[POST /api/auth/verify-school]
    ├─ tokenHash 검증
    ├─ studentId regex 검증
    ├─ 트랜잭션: User.schoolEmail + studentId + schoolVerifiedAt 셋, token consumedAt 마킹
    └─ 성공 응답 → "학교 인증 완료" 화면 + 마이페이지 리다이렉트
```

### 이메일 템플릿 (Gmail SMTP)

- Subject: `[GETIT] 학교 인증 메일`
- From: 기존 Gmail SMTP 발신자
- Body (HTML + 평문):
  - 한국어 반말 톤 (서비스 톤 일관성)
  - 1회용 링크 (`{AUTH_WEB_BASE}/verify-school?token=<평문토큰>`)
  - 30분 TTL 명시
  - "본인이 요청한 게 아니면 무시" 안내

> PM 결정 필요: 메일 본문 카피 톤 — 다른 서비스 메일 (이메일 인증/비번 리셋)과 톤 통일.

## 보안 / 운영

- **토큰**: 평문은 메일에만, DB는 SHA-256 해시. (기존 EmailVerifyToken / PasswordResetToken 패턴 동일)
- **TTL**: 30분 (이메일 인증 24h 보다 짧음 — 학교 메일은 비교적 즉시 처리)
- **1회용**: `consumedAt` 마킹 후 재사용 불가
- **Rate limit**: `/api/me/school-link` 분당 3건 / 유저 (기존 비번 리셋 패턴 재활용)
- **Enumeration 방어**: `/api/me/school-link` 는 항상 200 (이미 인증된 메일 / 다른 유저 메일 / 신규 메일 구분 X)
- **CSRF**: 기존 SSO 쿠키 정책 그대로 (`SameSite=Lax`, `Secure`)
- **PII**: 학번 / 학교메일은 로그에 절대 노출 X. Sentry 마스킹 룰 확인.

## 프론트엔드 (auth-web / 전 webs)

### auth-web

- `/signup` — nickname 필드 추가 (required), 실시간 unique check API 호출 (debounce 300ms)
- `/me` (마이페이지) — "학교 계정 연동" 카드 신규
  - 미인증: "학교 메일 입력 → 인증 받기" CTA
  - 인증됨: 학교 메일 + 학번 + 인증일 + "다시 인증하기" 링크
- `/verify-school` — 토큰 받고 학번 입력 폼 + 결과 페이지
- `/onboarding/nickname` — 기존 계정 nickname null → 강제 리다이렉트 페이지

### 전 webs (landing / hobby / shelf / board / letter)

- `useSession` 훅 응답에 nickname / schoolVerifiedAt 포함되도록 확장
- nickname null 감지 → `auth.get-it.cloud/onboarding/nickname?return=<현재URL>` 강제 redirect
- 사용자명 표시는 `user.nickname ?? user.name` 헬퍼로 통일
- (hobby 만) 모집글 작성 / 신청 버튼 — `schoolVerifiedAt == null` 이면 disabled + tooltip "학교 인증한 부원만 가능"

## 마이그레이션 정책 (라이브 리스크)

| 사용자 그룹 | 상태 | 처리 |
| :--- | :--- | :--- |
| 기존 학회 부원 (학교 이메일 가입자) | nickname null, schoolVerifiedAt null | 다음 로그인 시 nickname 강제 onboarding → 학교 인증 권유 배너 노출 |
| 기존 외부인 가입자 | nickname null, schoolVerifiedAt null | 다음 로그인 시 nickname 강제 onboarding → hobby lockout 명시 (학교 메일 없으면 hobby 사용 불가) |
| 신규 가입자 | 가입 시 nickname required | 마이페이지에서 학교 인증 자발 진행 |

### 공지 / 안내

- 배포 전 학회 부원 단톡방 사전 공지 (학교 인증 가이드 + lockout 외부인 안내)
- hobby home 상단 배너: "학교 인증한 부원만 모집/신청 가능. [지금 인증하기]"

### 롤백 시나리오

- 인프라 장애로 메일 발송 실패 시: `/api/me/school-link` 가 항상 200 응답이라 UX 영향 X, 사용자에게 "메일 안 오면 재발송" CTA
- DB 마이그레이션 실패 시: nullable 컬럼 추가만 한 1단계 마이그레이션이라 롤백 시 `DROP COLUMN` 으로 즉시 복구
- hobby 가드 false positive (학교 인증한 부원이 403 받음): 핫픽스 → `schoolVerifiedAt` 직접 SQL 보정 가능

## DoD (전체 작업 종료 기준)

- [ ] DB: `User.{nickname, studentId, schoolEmail, schoolVerifiedAt}` + `SchoolVerifyToken` 테이블 마이그레이션 적용 (dev / prod)
- [ ] auth-api: 닉네임 signup + school link / verify / resend 라우터 + Zod 스키마 + 단위/통합 테스트
- [ ] auth-web: 회원가입 nickname 필드 + 마이페이지 학교 연동 + verify-school 페이지 + nickname onboarding
- [ ] 전 webs: nickname onboarding 강제 redirect + `useSession` 확장 + 표시 helper 적용
- [ ] hobby: 모집글 / 신청 가드 + FE 비인증 사용자 disabled + 안내 카피
- [ ] 이메일 템플릿: Gmail SMTP 발송 동작 확인 (실제 메일 수신 테스트)
- [ ] QA: 신규 가입 / 기존 외부인 / 기존 부원 3 시나리오 검증
- [ ] 노션 / CLAUDE.md 메모리: Phase 10 entry 갱신

## Out of Scope (별도 epic / 후속)

- KNU 학적 시스템 OAuth 연동 (자동 학번 입력)
- 닉네임 변경 cooldown 정책 정교화
- shelf / board / letter 에 학교 인증 가드 (현재 디폴트: 외부인 사용 가능)
- 다중 학번 / 졸업생 처리 정책

## PM 결정 필요 항목 (체크리스트)

이 PRD 머지 전 / 구현 시작 전에 사용자(PM) 확인 필요.

- [ ] 닉네임 case-insensitive unique 구현 방법 (collation vs `nicknameLower` 컬럼)
- [ ] 닉네임 변경 cooldown — 무제한 / 30일 / 시즌제
- [ ] 닉네임 금칙어 목록 확정
- [ ] hobby 가드 — 조회까지 차단할지, 액션만 차단할지 (PRD 디폴트: 액션만)
- [ ] 학교 인증 메일 본문 카피 톤 (기존 메일과 통일)
- [ ] `User.nickname NOT NULL` 강제 시점 (마이그레이션 완료 후 N일?)

## 참고

- 기존 SSO 스키마: `apps/auth-api/prisma/schema.prisma`
- 기존 EmailVerifyToken / PasswordResetToken 패턴 그대로 차용
- hobby PRD: `.claude/projects/hobby.md`
- 워크플로우 / 머지 정책: `.claude/workflow.md`
