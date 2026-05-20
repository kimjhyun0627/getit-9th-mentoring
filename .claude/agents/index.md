# 멀티에이전트 구조

[← CLAUDE.md](../../CLAUDE.md)

## 글로벌 역할 카탈로그

서브에이전트는 `Agent` 도구의 적합한 `subagent_type`을 쓰되, 프롬프트 첫줄에 **역할 헤더**를 박아 페르소나 활성화.

| # | 역할 | 핵심 책임 | 연계 skill |
| :--- | :--- | :--- | :--- |
| 1 | **PM / Orchestrator** | 메인 세션이 직접. 4개 프로젝트 동기화, 서브에이전트 디스패치 | `dispatching-parallel-agents` |
| 2 | **Product Owner** | PRD 보완, 유저 시나리오, 스코프 결정 | `office-hours`, `plan-ceo-review` |
| 3 | **UI/UX Designer (×5 페르소나)** | 동일 페이지를 5가지 스타일로 병렬 디자인 → 멘토 선택 ([상세](designer.md)) | `design-shotgun`, `design-consultation`, `design-html` |
| 4 | **Frontend Engineer** | Vite+React+Tailwind+Zustand+shadcn 구현 | `frontend-design` |
| 5 | **Backend Engineer** | Express API, 비즈로직, 인증 | — |
| 6 | **DBA** | ERD 정합성, Prisma 스키마, 인덱스, 마이그레이션 | — |
| 7 | **DevOps** | Docker Compose, GCP 배포, GitHub Actions | `ship`, `land-and-deploy`, `setup-deploy` |
| 8 | **QA Engineer** | TDD 테스트 작성, E2E 시나리오, browse 도구 활용 | `qa`, `qa-only`, `test-driven-development` |
| 9 | **Code Reviewer / Tech Lead** | PR 리뷰, 아키텍처 가드, 리팩토링, 150/300줄 규칙 감시 | `review`, `plan-eng-review` |
| 10 | **Security Engineer** | 동시성, 프라이버시, 인증, 익명성, OWASP | `cso`, `security-review` |
| 11 | **UX Writer / Content Strategist** | 모든 사용자 보이는 텍스트 검토 (버튼/빈상태/에러/카피/aria). **issue 작성만, resolve는 FE 위임** ([상세](ux-writer.md)) | — |

## 프로젝트별 역할 매핑

각 프로젝트별 에이전트 투입 비중. **H** = High (핵심 활용), **M** = Medium (정상 활용), **L** = Light (선택적/소량), **—** = 거의 없음.

| 역할 | landing | auth | hobby | shelf | board | letter | infra/공통 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| PM / Orchestrator | M | M | M | M | M | M | M |
| Product Owner | L | M | **H** | M | **H** | M | — |
| UI/UX Designer (×5) | **H** | M | M | **H** | M | **H** | L |
| Frontend Engineer | M | M | **H** | **H** | **H** | M | — |
| Backend Engineer | — | **H** | **H** | **H** | **H** | M | M |
| DBA | — | M | **H** | M | **H** | L | — |
| DevOps | L | M | M | M | M | M | **H** |
| QA Engineer | L | **H** | **H** | M | **H** | M | — |
| Code Reviewer | M | M | M | M | M | M | M |
| Security | — | **H** | **H** | L | M | M | M |
| UX Writer | M | M | **H** | M | M | **H** | — |

### 프로젝트별 특이점

- **landing**: 디자인이 압도적으로 중요 (브랜딩). 기능은 단순 (4 카드 + 다크모드 토글)
- **auth**: Security 핵심. JWT/쿠키/CSRF 방어. QA로 인증 시나리오 검증
- **hobby** (취미메이트): 가장 복잡. Security(race condition + 오픈채팅 프라이버시), QA(동시성 시나리오), DBA(5 테이블) 모두 핵심
- **shelf** (스마트 서재): 외부 API 활용 → BE 비중 큼. 디자인 비중 큼 (아기자기한 서재 UX). Security는 API 키 노출 방지 정도
- **board** (칸반): BE 3개 모듈 분리. PO/PRD가 가장 정밀. DBA 비중 큼 (5 테이블 + 관계)
- **letter** (롤링페이퍼): 가장 단순. 익명성 보장이 핵심 (`is_mine` 응답 외 작성자 노출 X). 디자인이 시각적 매력 결정
- **infra/공통**: DevOps가 메인. 모노레포 셋업, Docker Compose, Traefik, GitHub Actions, GCP VM 프로비저닝

## 에이전트 호출 방식

### 기본 원칙

1. **메인 세션 = PM/Orchestrator**. 직접 코드 안 짬. issue 만들고 에이전트한테 던짐.
2. **Agent tool**의 `subagent_type`은 작업 성격에 맞춰:
   - 코드/탐색/일반 작업 → `general-purpose`
   - 코드 위치 찾기/심볼 찾기 → `Explore`
   - 구현 계획 수립 → `Plan`
   - claude API/SDK 질문 → `claude-code-guide`
3. **역할 헤더**를 프롬프트 첫 줄에 박아서 페르소나 활성화.
4. **병렬 작업** 가능 시 한 메시지에 여러 Agent 호출 (예: FE + BE 동시, 디자이너 5명 동시).
5. **결과 형태**를 명시 (diff / 표 / 체크리스트 / 테스트 결과 등).
6. **컨텍스트 절약**: 에이전트한테 작업 관련 `.claude/projects/<프로젝트>.md`만 Read하라고 지시 (CLAUDE.md만 자동 로드).
7. **개발자 에이전트는 git worktree로 격리 필수** (코드 편집 하는 에이전트만 해당, Plan/Explore 같은 read-only는 제외). 병렬 디스패치 시 동일 working tree에서 `git checkout`이 충돌해서 파일 손실됨. worktree 사용법은 아래 "Worktree 격리" 섹션 참조.

### Worktree 격리 (개발자 에이전트 강제)

병렬 개발자 에이전트가 한 working tree에서 `git checkout`을 번갈아 하면 한 에이전트 파일이 다른 에이전트한테 stash/revert로 날아감 (실제 발생함, PR #5/#10/#11에서 학습).

**에이전트 프롬프트에 항상 박는 도입부**:

```text
## Working tree 격리 (의무)

이 작업은 격리 worktree에서 진행해. 메인 worktree는 다른 에이전트가 점유 중일 수 있음.

\`\`\`bash
# 1) 격리 worktree 생성 (브랜치 같이)
WT="/tmp/getit-worktrees/<issue-slug>"
git -C /Users/jinhyun/DATA/KNU/GETIT/getit-9th-mentoring worktree add -b feat/<#>-<slug> "$WT" origin/main
cd "$WT"

# 2) 작업 (cd 유지)
pnpm install
# ... 코드 편집 ...

# 3) 커밋 + push (이 worktree에서)
git add -A
HUSKY=0 git commit -m "feat(<scope>): ..."
git push -u origin feat/<#>-<slug>
gh pr create ...

# 4) 끝나면 worktree 제거 (메인 worktree에서는 자동 정리 안 됨)
cd /Users/jinhyun/DATA/KNU/GETIT/getit-9th-mentoring
git worktree remove "$WT" --force
\`\`\`

규칙:
- `cd $WT` 이후 모든 Bash/Edit/Write는 그 worktree 안에서 작동
- 다른 worktree나 메인 working tree의 `git checkout`이 영향 못 미침
- 작업 완료 후 worktree 제거 (디스크 정리 + 에이전트 격리 종료 신호)
```

→ Agent tool의 `isolation: "worktree"` 파라미터는 시스템 미지원(WorktreeCreate hook 없음)이라 에이전트가 **직접 `git worktree add`** 호출.

### 프롬프트 템플릿

```text
[ROLE: <역할명>] for <프로젝트명>

## Mission
<구체 작업 (1-2줄)>

## Issue / Branch
- Issue #<N>: <링크>
- Branch: <type>/<#>-<slug>

## Context (필요 시 Read)
- 프로젝트 spec: .claude/projects/<프로젝트>.md
- 아키텍처: .claude/architecture.md (이미 알고 있으면 생략)
- 노션 PRD: <URL>
- 관련 파일: <경로 1>, <경로 2>
- 의존 작업: #<N> (완료)

## Constraints
- Stack: <해당 부분만 강조>
- TDD 필수
- 한 파일 300줄 max
- Conventional Commits로 커밋
- **Worktree 격리 필수** (개발자 에이전트): `git worktree add /tmp/getit-worktrees/<slug>`. 상세: 위 "Worktree 격리" 섹션
- **봇 코멘트(Gemini/CodeRabbit) 처리 필수**: 적용 또는 보류 답글 + resolve
  (silent resolve 금지). 상세: `.claude/workflow.md` "Thread resolve 규칙"

## Output
- 변경 파일 리스트 + 핵심 diff
- 통과한 테스트 목록
- 발견한 이슈/TODO (있으면 follow-up issue 제안)
- PR 본문 초안 (PR 템플릿 따름)
- **봇 코멘트 처리 결과**: 적용 N건 / 보류 N건 / 각 thread URL
```

### 예시 호출 (Backend Engineer)

```text
[ROLE: Backend Engineer] for hobby.get-it.cloud

## Mission
POST /api/posts (모집 게시글 작성) API 구현.
동시성 처리 필수: 정원 마감 시 거부.

## Issue / Branch
- Issue #12
- Branch: feat/12-post-create-api

## Context
- 프로젝트 spec: .claude/projects/hobby.md
- 노션 API 명세: https://knu-getit.notion.site/API-...
- 관련 파일: apps/hobby-api/src/routes/posts.js (생성), apps/hobby-api/prisma/schema.prisma
- 의존: #8 (Prisma 스키마) 완료

## Constraints
- Express + Prisma + Zod
- 트랜잭션 사용 (Race condition 방어)
- TDD: Vitest + supertest로 테스트 먼저
- 300줄 max

## Output
- src/routes/posts.js, src/services/post.js, tests/posts.test.js
- 테스트 케이스: 정상 생성, 정원 초과 거부, 동시 요청 시 1명만 성공
- PR 본문 초안
```

### 병렬 작업 패턴

같은 issue 안의 독립 작업은 한 메시지에 여러 Agent 호출:

```text
# 메인 세션 (PM/Orchestrator)
- Agent #1: [ROLE: Frontend Engineer] — 모집 게시글 작성 폼 UI
- Agent #2: [ROLE: Backend Engineer] — POST /api/posts API
- Agent #3: [ROLE: DBA] — Posts 테이블 인덱스 검토
→ 셋 다 완료되면 결과 종합 + PR 1개로 묶기 (또는 각자 PR)
```

`superpowers:dispatching-parallel-agents` skill 활용.

### Code Reviewer / QA 호출 패턴

PR 생성 후:

1. PM이 Code Reviewer 에이전트 호출 → `gh pr review` + 코멘트
2. CodeRabbit이 자동 리뷰 (병렬)
3. QA 에이전트 호출 → 시나리오 테스트 + browse 도구로 실제 화면 확인 → 결과를 PR comment로
4. 통과 → PM이 `gh pr merge --squash`
5. 실패 → `gh issue create --label type/bug` + 개발자 재호출

### 컨텍스트 전달 원칙

- CLAUDE.md는 모든 세션에 자동 로드되므로 **CLAUDE.md에 있는 내용은 반복 설명 X**
- `.claude/` 하위 문서는 **필요한 작업 시에만** 에이전트가 직접 Read
- 프로젝트별 PRD/API 명세는 **노션 URL로 참조** (필요 시 에이전트가 직접 browse)
- 이슈/PR 번호로 작업 맥락 추적
- 큰 결정은 적절한 `.claude/` 문서에 박아서 다음 세션에서도 일관성 유지
