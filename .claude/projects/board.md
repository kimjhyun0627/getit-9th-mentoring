# board — 팀 칸반

[← CLAUDE.md](../../CLAUDE.md)

- **도메인**: `board.get-it.cloud`
- **앱**: `apps/board-web/`, `apps/board-api/`
- **인증**: SSO
- **난이도**: ⭐⭐⭐⭐
- **추천 디자이너 페르소나**: Minimalist, Tech-Dark

## 한줄 요약

Trello/Jira 스타일 팀 칸반 보드. Todo/Doing/Done 컬럼에 카드 CRUD + 담당자 지정 + 컬럼 이동.

## 핵심 시나리오

1. User A가 팀 프로젝트 보드 생성
2. 카드 생성 → 담당자 지정 → Todo 컬럼에 배치
3. 진행 상태 바뀌면 Doing/Done 컬럼으로 이동
4. 업무 변경 시 카드 수정, 종료 시 삭제

## DB 테이블 (5개)

- `users` (SSO에서, user_id만)
- `projects` (id, owner_id, name, description)
- `project_members` (project_id × user_id 다대다)
- `board_columns` (project_id, name, order — Todo/Doing/Done이 기본)
- `cards` (column_id, title, description, assignee_id, order)

## 핵심 API (18개)

- Auth: 회원가입/로그인/내정보 (SSO 사용 시 외부 위임)
- Users: 사용자 목록 (카드 담당자 지정용)
- Projects: 목록/생성/상세/수정/삭제
- Columns: 생성/수정/삭제 (프로젝트 안)
- Cards: 생성/상세/수정/삭제/이동/담당자지정

## 🔥 핵심 챌린지

### 협업 구조 (PRD가 가장 정밀)

- 사용자가 본인 생성/참여 프로젝트만 접근 가능
- `project_members` 권한 검증을 모든 카드/컬럼 API에 적용
- 권한 없는 접근은 403 Forbidden

### 드래그 앤 드롭 vs 버튼 (Frontend)

- 노션 PRD: 드래그앤드롭은 선택 구현 (FE 1명이라 부담)
- MVP: 드롭다운 또는 버튼으로 카드 이동
- 여유 시: react-dnd or dnd-kit로 드래그 추가

### 카드 순서 관리 (DBA)

- 카드의 `order` 필드 = float 또는 integer
- 카드 이동 시 모든 카드 재정렬은 비효율 → between-keys 알고리즘 권장

### 상태 동기화 (FE-BE)

- 카드 이동/수정 시 전체 새로고침 X
- TanStack Query의 optimistic update + invalidation

## 우선순위 에이전트

PO > BE > DBA > FE > QA > Designer > Security

## 노션 참고

- 프로젝트: <https://knu-getit.notion.site/363694c484f780378e09d81556cc71b8>
- PRD: <https://knu-getit.notion.site/PRD-363694c484f781b58a26d0a5bc1115ee>
- API: <https://knu-getit.notion.site/API-363694c484f781308c67dc3640cc91be>
- ERD: <https://knu-getit.notion.site/DB-ERD-363694c484f7818bafc5f389734d3d5e>
- QA: <https://knu-getit.notion.site/QA-Checklist-363694c484f781c7b2e7c2eac8a753c4>
