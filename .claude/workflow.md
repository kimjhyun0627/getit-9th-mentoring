# GitHub-driven 개발 워크플로우

[← CLAUDE.md](../CLAUDE.md)

**모든 작업은 GitHub Issue → Branch → PR → Review → Merge 사이클을 거친다.**
직접 main에 push 금지. `gh` CLI를 적극 활용.

## 워크플로우 사이클

```text
[1] PM/PO: Issue 생성 (gh issue create)
        ↓
[2] 개발자: gh issue develop으로 브랜치 자동 생성
        ↓
[3] 개발자: TDD로 코딩 + 커밋 (Conventional Commits)
        ↓
[4] 개발자: gh pr create (PR 템플릿 사용)
        ↓
[5] CodeRabbit: 자동 코드 리뷰 코멘트
        ↓
[6] 개발자: 리뷰 반영 (필요 시 /apply 또는 수동 수정)
        ↓
[7] Code Reviewer 에이전트: 최종 리뷰
        ↓
[8] QA Engineer 에이전트: 시나리오 테스트
        ↓
[9-A] 통과 → gh pr merge --squash
[9-B] 버그 발견 → gh issue create --label bug → [1]로
```

## Issue 컨벤션

### 라벨 시스템

| 카테고리 | 라벨 |
| :--- | :--- |
| 종류 | `type/feat`, `type/bug`, `type/refactor`, `type/test`, `type/docs`, `type/chore` |
| 프로젝트 | `project/landing`, `project/auth`, `project/hobby`, `project/shelf`, `project/board`, `project/letter`, `project/infra` |
| 역할 | `role/fe`, `role/be`, `role/dba`, `role/devops`, `role/qa`, `role/design`, `role/security` |
| 우선순위 | `priority/p0`, `priority/p1`, `priority/p2` |
| 상태 | `status/todo`, `status/in-progress`, `status/in-review`, `status/blocked` |

### Issue 제목

`[<project>] <짧은 설명>` (예: `[hobby] 모집 게시글 작성 API`)

### Issue 본문 템플릿

```markdown
## 배경 / 목적
<왜 필요한가>

## 작업 내용
- [ ] <작업1>
- [ ] <작업2>

## 수용 기준 (Acceptance Criteria)
- <조건1>
- <조건2>

## 관련 링크
- PRD:
- 관련 Issue: #N
```

## 브랜치 컨벤션

**형식**: `<type>/<issue#>-<short-slug>`

| Type | 예시 |
| :--- | :--- |
| `feat` | `feat/12-post-create-api` |
| `fix` | `fix/34-race-condition-on-apply` |
| `refactor` | `refactor/56-extract-auth-middleware` |
| `test` | `test/78-add-e2e-signup` |
| `chore` | `chore/90-bump-deps` |
| `docs` | `docs/11-update-readme` |

### 원칙

- 모든 브랜치는 issue에서 파생: `gh issue develop <issue#> --name <type>/<#>-<slug>`
- `main`에서 분기. `main`에 머지하면 자동 삭제
- 핫픽스도 `fix/` 사용 (긴급 표시는 issue 라벨로)

## 커밋 컨벤션 (Conventional Commits)

```text
<type>(<scope>): <short summary>

<body — 무엇을 왜 바꿨는지>

Closes #<issue#>
```

**Type**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`, `perf`, `build`, `ci`
**Scope**: 앱 또는 패키지 이름 (예: `hobby-api`, `theme`, `infra`)

### 예시

```text
feat(hobby-api): 모집 게시글 작성 API 추가

POST /api/posts 엔드포인트 구현.
- Zod 스키마 입력 검증
- 동시성 처리: 정원 마감 시 신청 거부 (트랜잭션)

Closes #12
```

Commitlint가 강제. Husky pre-commit hook으로 검증.

## PR 컨벤션

**제목**: 커밋 컨벤션과 동일 (`<type>(<scope>): <summary>`)

### PR 템플릿 (`.github/pull_request_template.md`)

```markdown
## 변경 요약
- <bullet 1>
- <bullet 2>

## 관련 Issue
Closes #<issue#>

## 테스트 방법
1. <단계 1>
2. <단계 2>

## 스크린샷 / 영상 (UI 변경 시)
<이미지 첨부>

## 체크리스트
- [ ] TDD: 테스트 먼저 작성
- [ ] 한 파일 300줄 이내
- [ ] ESLint / Prettier 통과
- [ ] 다크모드에서 확인 (FE)
- [ ] Swagger 도큐멘트 업데이트 (API 변경 시)
- [ ] README 또는 도큐멘트 업데이트
```

## 자동 리뷰 봇 통합

메인 리뷰어는 **CodeRabbit** (`.coderabbit.yaml`). PR APPROVED 받아야 머지 게이트 통과.
Gemini Code Assist는 베타 상태에서 `APPROVED` 리뷰 상태를 안 줘서 게이트에 못 씀
(2026년 5월 기준). 설치돼있으면 보조 의견용 OK.

### CodeRabbit (메인 — 머지 게이트)

- **설치**: GitHub Marketplace → CodeRabbit 앱 → 레포 권한 부여 (무료 티어)
- **설정 파일**: `.coderabbit.yaml` (레포 루트) — `request_changes_workflow: true` 로 APPROVE/REQUEST_CHANGES 리뷰 상태 강제
- **트리거**: PR 열리면 자동 리뷰
- **상호작용**: `@coderabbitai resolve`, `@coderabbitai pause`, `@coderabbitai full review`

### 봇 제안 apply 자동화 (Claude가 직접 처리)

Claude(주로 개발자 에이전트)가 Gemini/CodeRabbit 제안을 자동 적용 가능. 두 가지 방식.
**방식 A는 CodeRabbit 전용** — Gemini는 슬래시 명령 미지원, 방식 B로만 처리.

#### 방식 A — 코멘트 trigger 명령 (CodeRabbit 전용)

```bash
gh pr comment <PR#> --body "@coderabbitai apply"
```

CodeRabbit이 지원하는 자동 명령:

- `@coderabbitai resolve` — 해결된 코멘트 마크
- `@coderabbitai full review` — 전체 재리뷰
- `@coderabbitai pause` — 일시 정지

#### 방식 B — Claude가 직접 diff 적용

1. `gh pr view <PR#> --comments` 로 CodeRabbit 코멘트 + suggested diff 추출
2. 각 제안을 검토 (멘토 관점: 합리적인가? 코드 스타일/300줄 규칙/TDD 위반 없나?)
3. `Edit` 도구로 직접 코드 수정
4. 새 커밋: `fix(<scope>): apply CodeRabbit suggestions for #<PR#>`
5. `gh pr comment <PR#> --body "CodeRabbit 제안 적용 완료. <어떤 항목 처리했는지 요약>"`
6. 적용 안 한 제안은 이유 명시 (예: "300줄 규칙과 충돌", "프로젝트 컨벤션과 다름")

#### 판단 규칙

Code Reviewer / 개발자 에이전트가 따름:

- 🟢 **자동 적용**: 명백한 버그, 사소한 스타일, 누락된 import, 안전한 리팩토링
- 🟡 **검토 후 적용**: 로직 변경 제안, 새 의존성 추가, 테스트 추가
- 🔴 **무시 + 사유 코멘트**: CLAUDE.md 컨벤션 위반, 프로젝트 스코프 밖, 의도된 동작

## 머지 정책

- **Squash merge 기본** (히스토리 깔끔)
- main 브랜치 보호: 직접 push 금지, PR만 가능
- 머지 후 브랜치 자동 삭제

### 필수 머지 게이트 (Branch Protection)

PR이 main에 머지되려면 **아래 4개 모두** 통과해야 함:

1. **CI 그린** — `format / lint / test / build` GitHub Actions workflow 성공
2. **CodeRabbit APPROVED** — `coderabbitai approved` workflow 통과 (`.github/workflows/coderabbit-approval-gate.yml`)
   - CodeRabbit이 COMMENTED만 남기면 통과 X. `APPROVED` 리뷰 state 필요.
   - 개선 적용 후 `@coderabbitai full review` 댓글로 재리뷰 요청 가능.
3. **모든 review thread resolved** — `required_conversation_resolution: true`. 미해결 코멘트 1개라도 있으면 머지 X.
4. **PR 필수** — `main`에 직접 push 금지. self-PR도 OK (`required_approving_review_count: 0`).

추가 보호:

- `required_linear_history: true` (squash 만 허용)
- `allow_force_pushes: false`, `allow_deletions: false`
- admin은 긴급 시 `gh pr merge --admin` 으로 bypass 가능 (`enforce_admins: false`).

### CodeRabbit 운영

- 설정: `.coderabbit.yaml` — 한국어 반말 톤, chill profile, JS/api/web path_instructions, lockfile/dist/coverage 등 path_filter 무시.
- 리뷰 흐름: PR opened → CodeRabbit 자동 리뷰 → 개발자가 fix + 코멘트 resolve (`@coderabbitai resolve`) → `@coderabbitai full review`로 재리뷰 → APPROVED 받으면 머지 게이트 통과.
- `request_changes_workflow: true` 로 APPROVE/REQUEST_CHANGES 리뷰 상태 강제.
- **사용자 액션 (한 번)**: CodeRabbit GitHub App 설치 → 본 레포에 권한 부여.

### Gemini Code Assist (보조, 옵션)

- 설치되면 추가 의견 제공. 베타라 `APPROVED` 상태 미지원 — 머지 게이트엔 안 들어감.
- 무시 또는 보조 시각 정도로 활용.

## 에이전트별 GitHub 책임

| 에이전트 | gh 명령 사용 |
| :--- | :--- |
| **PM / Orchestrator** | `gh issue create`, `gh issue list`, `gh project` 보드 관리 |
| **Product Owner** | `gh issue create` (feature 명세), 수용 기준 작성 |
| **개발자 (FE/BE/DBA/DevOps)** | `gh issue develop`, 커밋, `gh pr create`, 리뷰 반영 |
| **QA Engineer** | `gh issue create --label type/bug`, PR comment로 테스트 결과 |
| **Code Reviewer** | `gh pr review`, `gh pr comment`, approve/request changes |
| **Security Engineer** | `gh issue create --label role/security`, security audit comment |
