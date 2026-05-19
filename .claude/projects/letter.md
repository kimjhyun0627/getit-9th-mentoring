# letter — GETIT 익명 롤링페이퍼

[← CLAUDE.md](../../CLAUDE.md)

- **도메인**: `letter.get-it.cloud`
- **앱**: `apps/letter-web/`, `apps/letter-api/`
- **인증**: SSO (부원 확인용) + 메시지는 익명
- **난이도**: ⭐⭐⭐
- **추천 디자이너 페르소나**: Warm, Playful

## 한줄 요약

GETIT 동아리 부원끼리 익명으로 롤링페이퍼 메시지를 남기는 화이트보드.

## 핵심 시나리오

1. SSO 로그인 (부원 확인)
2. 빈 화이트보드에서 포스트잇 형태로 메시지 작성
3. 다른 사람 메시지는 익명으로 표시
4. 본인 메시지는 "내 메시지"로 식별 + 편집/삭제 가능

## DB 테이블 (1개)

- `Log` (id, author_id, content, created_at) — author_id는 DB에 저장하되 외부에 절대 노출 X

## 핵심 API (3-4개)

- `POST /api/messages` — 메시지 작성 (JWT 필요)
- `GET /api/messages` — 메시지 목록 조회 (각 메시지에 `is_mine: boolean` 포함, author 정보는 X)
- `DELETE /api/messages/:id` — 본인 메시지만 삭제 (서버에서 author 검증)
- `PATCH /api/messages/:id` — 본인 메시지 편집 (선택)

## 🔥 핵심 챌린지

### 익명성 보장 (Security 핵심)

- **다른 유저가 볼 때**: API 응답에 author_id / author 정보 절대 포함 X
- **본인이 볼 때**: `is_mine: true` 플래그로만 식별
- DB 쿼리 시 JOIN으로 author 정보 가져오지 말고, 백엔드가 토큰의 user_id와 비교만
- 노션 PRD의 "4자리 비밀번호 삭제"는 폐기 (SSO 본인 인증으로 대체)

### 화이트보드 UX (Designer)

- 포스트잇 그리드 (마치 실제 칠판에 붙은 것처럼)
- 색깔 다양한 포스트잇
- 정렬: 최신 위 or 무작위 위치 (선택 사항)

### 동시성 (BE)

- 동아리원 다수 동시 접속 → 단순 INSERT라 큰 문제 없음
- 다만 폴링 vs SSE vs WebSocket으로 실시간 업데이트 여부 결정 필요

## 우선순위 에이전트

Security > Designer (×5) > FE > BE > QA

## 노션 참고

- 프로젝트: <https://knu-getit.notion.site/GETIT-363694c484f78066bce9c1955ff43411>
- PRD: <https://knu-getit.notion.site/PRD-363694c484f78103a18ff0c284b8fa6d>
- API: <https://knu-getit.notion.site/API-363694c484f781cf9897c6262c4a1ed5>
- ERD: <https://knu-getit.notion.site/DB-ERD-363694c484f7811880c4d660947e810b>
- QA: <https://knu-getit.notion.site/QA-Checklist-363694c484f781a69fd8c53e42d1f240>
