# school-auth — 학교 인증 + 닉네임 + 학번

[← CLAUDE.md](../../CLAUDE.md)

- **스코프**: 전 앱 공통 (auth-api / auth-web 주역, hobby 가드 적용, landing /me 진입점)
- **대상 도메인**: `auth.get-it.cloud`, `hobby.get-it.cloud`, `get-it.cloud` (landing /me)
- **연관 앱**: `apps/auth-api`, `apps/auth-web`, `apps/hobby-api`, `apps/hobby-web`, `apps/landing` (/me 마이페이지), 기타 `*-web` (nickname onboarding)
- **난이도**: ⭐⭐⭐⭐
- **추천 디자이너 페르소나**: Tech-Dark (auth + landing 통일), Playful (hobby 가드 안내)

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

**원칙**: hobby 의 **모든 mutation** (POST / PATCH / PUT / DELETE) 에 학교 인증 가드 적용. 조회(GET) 는 미인증자도 허용.

| Method | Path | 가드 동작 |
| :--- | :--- | :--- |
| POST | `/api/posts` | `schoolVerifiedAt == null` 이면 403 `{ error: 'SchoolVerificationRequired', message: '학교 인증이 필요합니다.' }` |
| PATCH / DELETE | `/api/posts/:id` | 같은 가드 (작성자 본인이어도 인증 풀리면 차단) |
| POST | `/api/applications` | 같은 가드 |
| PATCH / DELETE | `/api/applications/:id` (취소 / 상태 변경) | 같은 가드 |
| POST | `/api/reports` (노쇼 신고 등) | 같은 가드 |
| GET | (조회 계열) | 가드 X — 외부인도 hobby 둘러보기는 가능 |

> 구현 가이드: 라우터 단위가 아니라 **HTTP method 기반 미들웨어** 로 일괄 적용해서 신규 mutation 라우터가 누락되지 않게 한다.
>
> PM 결정 필요: **조회 자체도 차단할지** — 본 PRD 디폴트는 "조회 OK, 모든 mutation 차단" (둘러보고 가입 동기 부여).

### hobby 안내 카피 (미인증 사용자 진입 시)

미인증 사용자가 hobby 에 들어왔을 때 "왜 안 되는지 + 어디로 가야 하는지" 가 0.5초 안에 보여야 한다. **403 토스트만으로는 부족** — 진입 시점에 명확한 안내가 필요.

#### hobby home 진입 시 안내 카드

- **위치**: `apps/hobby-web` home (`/`) 페이지 상단 — 모집글 리스트 위
- **노출 조건**: 로그인 + `schoolVerifiedAt == null` (비로그인은 기존 RequireSignIn 패턴 그대로)
- **형태**: dismissible 안내 카드 (또는 page top banner — 디자이너 페르소나 판단). 닫아도 세션 내에서만 닫힘 (localStorage 영구 dismiss 금지 — 행동 유도가 목적).
- **카피 (strict, 변경 금지)**:
  - 제목: **"hobby 서비스를 사용하려면 학교 인증이 필요해요"**
  - 보조: "모집글 작성 / 신청은 학교 인증한 부원만 가능해요. 학교 메일(@knu.ac.kr) 한 통이면 끝나요."
  - CTA 버튼: **"학교 인증하러 가기"** → `https://auth.get-it.cloud/me?focus=school-link`
- **톤**: Playful 페르소나 (hobby 의 기존 톤 유지) — 반말 OK, 위협적이지 않게.
- **a11y**: `role="status"` + 키보드 접근 가능한 dismiss 버튼.

#### `?focus=school-link` 쿼리 처리

- auth-web `/me` 페이지가 `focus=school-link` 쿼리를 받으면 **학교 계정 연동 카드를 자동 스크롤 + 시각 강조** (예: 카드 border 1초 highlight, focus ring).
- 같은 패턴을 landing `/me` 에서도 재사용 (아래 "landing /me 마이페이지" 섹션 참고).
- 쿼리 미존재 시 평상시 마이페이지.

## 닉네임 정책

| 항목 | 정책 |
| :--- | :--- |
| 길이 | 2 ~ 20 자 |
| 허용 문자 | 한글 (완성형 + 자음/모음) / 영문 / 숫자 / `-` / `_` |
| 정규식 | `^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9_-]{2,20}$` (자모 단독 닉네임 — 예: `ㅋㅋ`, `ㅎㅎ` — 허용) |
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

```text
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
    │   └─ schoolEmail unique 충돌 시 (다른 유저가 이미 인증한 메일) → 409 `{ error: 'SchoolEmailAlreadyInUse' }`
    │       FE: "다른 계정에서 이미 사용 중인 학교 메일이야. 본인 계정이 맞으면 운영자에게 문의." 안내
    └─ 성공 응답 → "학교 인증 완료" 화면 + 마이페이지 리다이렉트
```

### 에러 응답 사전

| HTTP | error code | 발생 조건 | FE 처리 |
| :--- | :--- | :--- | :--- |
| 400 | `InvalidSchoolEmailDomain` | `@knu.ac.kr` 아닌 도메인 | 폼 인라인 에러 |
| 400 | `InvalidStudentId` | 8자리 숫자 아님 | 폼 인라인 에러 |
| 401 | `TokenInvalidOrExpired` | 토큰 없음 / 만료 / 사용됨 | 재발송 CTA |
| 409 | `SchoolEmailAlreadyInUse` | 다른 유저가 이미 인증한 학교 메일 | 운영자 문의 안내 |
| 429 | `RateLimited` | 분당 3건 초과 | "잠시 후 재시도" 토스트 |

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
- **Feature flag**: `SCHOOL_AUTH_GUARD_ENABLED` (hobby mutation 가드), `NICKNAME_ONBOARDING_ENFORCED` (nickname 강제 모드) — env 기반. 결함 시 데이터는 보존하고 동작만 비활성화 가능.

## 프론트엔드 (auth-web / 전 webs)

### auth-web

- `/signup` — nickname 필드 추가 (required), 실시간 unique check API 호출 (debounce 300ms)
- `/me` (마이페이지) — "학교 계정 연동" 카드 신규
  - 미인증: "학교 메일 입력 → 인증 받기" CTA
  - 인증됨: 학교 메일 + 학번 + 인증일 + "다시 인증하기" 링크
- `/verify-school` — 토큰 받고 학번 입력 폼 + 결과 페이지
- `/onboarding/nickname` — 기존 계정 nickname null → 강제 리다이렉트 페이지

### 전 webs (landing / hobby / shelf / board / letter)

- `useSession` 훅 응답에 nickname / schoolVerifiedAt / studentId 포함되도록 확장
- nickname null 감지 → `auth.get-it.cloud/onboarding/nickname?return=<현재URL>` 강제 redirect
- 사용자명 표시는 `user.nickname ?? user.name` 헬퍼로 통일
- (hobby 만) 모집글 작성 / 신청 버튼 — `schoolVerifiedAt == null` 이면 disabled + tooltip "학교 인증한 부원만 가능"

### landing `/me` 마이페이지 (신규)

GETIT 9기 허브(landing)에서 사용자가 자기 상태를 한 눈에 보고 학교 인증으로 진입할 수 있게 한다. auth-web `/me` 와 별개로 **landing 도메인 (`get-it.cloud`) 안에서** 가벼운 마이페이지 제공 — 다른 서비스 카드들 옆에서 자연스럽게 마이페이지 진입.

#### 라우트 / 진입

- 라우트: `apps/landing` 의 `/me` (신규)
- landing 헤더에 **"마이페이지"** 링크 추가 — **로그인 시에만 노출** (비로그인 시는 기존 "로그인" CTA 그대로)

#### 비로그인 처리

- `shelf` 의 `RequireSignIn` 컴포넌트 패턴 참고 (`apps/shelf-web/...RequireSignIn...`)
- 비로그인 시 "로그인이 필요해요" + "로그인하러 가기" CTA (auth-web `/login?return=https://get-it.cloud/me`)

#### 로그인 시 표시 항목

| 항목 | 출처 | 상세 |
| :--- | :--- | :--- |
| 닉네임 | `useSession().user.nickname` | null 이면 "닉네임을 설정해주세요" + onboarding 유도 (nickname onboarding 강제 흐름과 통합 — sub-issue #540) |
| 가입 일자 | `useSession().user.createdAt` (없으면 `/api/me` 응답에 추가) | YYYY-MM-DD 한국어 |
| 학교 인증 상태 | `useSession().user.schoolVerifiedAt` / `studentId` | **인증됨**: "학교 인증 완료 · 학번 20241234" / **미인증**: "학교 미인증" + **"학교 인증하기"** 버튼 |
| 학교 인증하기 버튼 | — | 클릭 시 `https://auth.get-it.cloud/me?focus=school-link` 로 redirect. `focus` 쿼리로 auth-web 마이페이지에서 학교 연동 카드 자동 강조 (위 "hobby 안내 카피 — `?focus=school-link` 쿼리 처리" 참고) |

#### 디자인 톤

- **Tech-Dark 페르소나** (landing 전체 톤과 통일 — PR #177 auth-web 도 동일 페르소나)
- 다크모드 우선 / 라이트모드 대응
- 키보드 접근성 (tab order, focus ring), 스크린리더 친화 (`aria-label`)

#### Out of scope (landing /me)

- 닉네임 변경 / 비밀번호 변경 등 mutation — auth-web `/me` 로 위임
- 학교 인증 폼 자체 — landing /me 에는 진입 버튼만, 실제 입력은 auth-web `/verify-school` 흐름

> 의도: landing /me 는 **상태 확인 + 행동 진입점** 역할. 본격적인 계정 관리는 auth-web 으로 일임.

## 마이그레이션 정책 (라이브 리스크)

| 사용자 그룹 | 상태 | 처리 |
| :--- | :--- | :--- |
| 기존 학회 부원 (학교 이메일 가입자) | nickname null, schoolVerifiedAt null | 다음 로그인 시 nickname 강제 onboarding → 학교 인증 권유 배너 노출 |
| 기존 외부인 가입자 | nickname null, schoolVerifiedAt null | 다음 로그인 시 nickname 강제 onboarding → hobby lockout 명시 (학교 메일 없으면 hobby 사용 불가) |
| 신규 가입자 | 가입 시 nickname required | 마이페이지에서 학교 인증 자발 진행 |

### 공지 / 안내

- 배포 전 학회 부원 단톡방 사전 공지 (학교 인증 가이드 + lockout 외부인 안내)
- hobby home 상단 안내 카드 (strict 카피): "hobby 서비스를 사용하려면 학교 인증이 필요해요" + "학교 인증하러 가기" → `auth.get-it.cloud/me?focus=school-link` (상세: "hobby 안내 카피" 섹션)
- landing `/me` 마이페이지에서도 학교 인증 미인증자에게 "학교 인증하기" 버튼 노출 — 같은 redirect 경로

### 롤백 시나리오

**원칙**: 운영 중 사용자가 이미 입력한 `nickname / studentId / schoolEmail / schoolVerifiedAt` 값은 **데이터 자산**. 롤백 시 `DROP COLUMN` 금지 — 데이터 소실 위험이 있어 별도 백업 절차를 통과한 deprecation 단계에서만 컬럼 제거.

| 장애 유형 | 롤백 전략 |
| :--- | :--- |
| 인프라: Gmail SMTP 발송 실패 | `/api/me/school-link` 는 항상 200 응답이라 UX 영향 X. 사용자에게 "메일 안 오면 재발송" CTA 노출. SMTP 복구 시점부터 신규 토큰 메일 정상 발송. |
| FE/BE 결함: hobby 가드 false positive (학교 인증한 부원이 403) | feature flag (`SCHOOL_AUTH_GUARD_ENABLED`) 로 가드 미들웨어 **즉시 OFF**. 데이터는 보존. 결함 수정 후 다시 ON. |
| nickname 강제 onboarding 결함 (무한 리다이렉트 등) | feature flag (`NICKNAME_ONBOARDING_ENFORCED`) 로 강제 모드 OFF → 모달은 노출하되 skip 허용 모드로 강등. 데이터는 보존. |
| DB 마이그레이션 자체가 실패 | Prisma migrate 자체가 트랜잭션이라 partial state 가능성 낮음. 만약 partial 상태면 dump → restore 절차. **`DROP COLUMN` 으로 즉시 롤백은 절대 금지** (이미 입력된 row 있을 경우 데이터 유실). |
| 전체 feature 회수 결정 (오래 운영 후) | (1) 코드 경로 비활성화 → (2) 최소 30일 모니터링 + 백업 → (3) 별도 PR 로 컬럼 제거 마이그레이션 (별도 PM 승인 필요) |

## DoD (전체 작업 종료 기준)

- [ ] DB: `User.{nickname, studentId, schoolEmail, schoolVerifiedAt}` + `SchoolVerifyToken` 테이블 마이그레이션 적용 (dev / prod)
- [ ] auth-api: 닉네임 signup + school link / verify / resend 라우터 + Zod 스키마 + 단위/통합 테스트
- [ ] auth-web: 회원가입 nickname 필드 + 마이페이지 학교 연동 + verify-school 페이지 + nickname onboarding + `?focus=school-link` 쿼리 강조
- [ ] 전 webs: nickname onboarding 강제 redirect + `useSession` 확장 (nickname / schoolVerifiedAt / studentId) + 표시 helper 적용
- [ ] hobby: 모집글 / 신청 가드 + FE 비인증 사용자 disabled + **hobby home 안내 카드 (strict 카피)** + 토스트
- [ ] landing: `/me` 마이페이지 (닉네임 / 가입일 / 학교 인증 상태 / "학교 인증하기" 버튼) + 헤더 "마이페이지" 링크 (로그인 시만)
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
