# shelf — 스마트 서재

[← CLAUDE.md](../../CLAUDE.md)

- **도메인**: `shelf.get-it.cloud`
- **앱**: `apps/shelf-web/`, `apps/shelf-api/`
- **인증**: SSO
- **난이도**: ⭐⭐
- **추천 디자이너 페르소나**: Warm, Editorial

## 한줄 요약

외부 도서 검색 API로 책을 찾아서 나만의 아기자기한 서재에 표지/제목/감상평을 저장.

## 핵심 시나리오

1. 우연히 본 책 → 잊지 않게 검색 후 "읽고 싶은 책" 저장
2. 완독한 책 → 간편하게 "읽은 책" + 감상평 저장
3. 내 서재 페이지에서 자주 읽는 작가 기반으로 다음 책 탐색

## DB 테이블 (제안 — 노션 ERD 비어있음)

- `Users` (SSO에서 가져옴, user_id만)
- `Books` (외부 API에서 가져온 책 정보 캐시: isbn, title, author, cover_url, ...)
- `BookShelves` (user_id, book_id, status: 'WANT' | 'READ' | 'READING', rating, review, ...)

## 핵심 API (3개)

- `GET /api/books/search?q=<keyword>` — 외부 도서 API 검색 (중계)
- `GET /api/books/details/:isbn` — 도서 상세
- `POST /api/analysis/reading-type` — 나의 독서 타입 분석 (보너스 기능)

추가 필요:

- `GET /api/shelves/me` — 내 서재 조회
- `POST /api/shelves` — 책 추가
- `PATCH /api/shelves/:bookId` — 감상평/상태 수정
- `DELETE /api/shelves/:bookId` — 서재에서 제거

## 🔥 핵심 챌린지

### 외부 API 키 보호 (Security)

- 카카오 도서 API or 알라딘 API or 네이버 도서 API
- 키는 **백엔드 .env에만** 보관. 프론트에 절대 노출 X
- BE가 중계 서버 역할 (검색 요청 받고 외부 API 호출 후 결과 반환)

### 서재 UX (Designer)

- "아기자기한 서재" 느낌 — 책 표지 그리드, 책장 모티프, 따뜻한 색감
- 감상평 입력은 친근한 톤
- 빈 서재 placeholder도 따뜻하게

### 외부 API 응답 캐싱

- 같은 isbn 검색 시 DB의 Books 캐시 활용 (API 호출 절약)
- 캐시 만료 정책 (TTL or refresh on demand)

## 우선순위 에이전트

Designer (×5) > FE > BE > PO > QA > DBA > Security

## 노션 참고

- 프로젝트: <https://knu-getit.notion.site/363694c484f780eead78cf0c71a0e86d>
- PRD: <https://knu-getit.notion.site/PRD-363694c484f7818aa92fe3844f95b2b2>
- API: <https://knu-getit.notion.site/API-363694c484f781f3b7a1c1e8a459e37a>
- ERD: <https://knu-getit.notion.site/DB-ERD-363694c484f781f3b37bcd507e0e4a62> (비어있음)
- QA: <https://knu-getit.notion.site/QA-Checklist-363694c484f78183b59bcdd86de60b9e>
