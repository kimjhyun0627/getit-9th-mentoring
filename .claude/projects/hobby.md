# hobby — 취미메이트

[← CLAUDE.md](../../CLAUDE.md)

- **도메인**: `hobby.get-it.cloud`
- **앱**: `apps/hobby-web/`, `apps/hobby-api/`
- **인증**: SSO (`.get-it.cloud` 쿠키)
- **난이도**: ⭐⭐⭐⭐⭐
- **추천 디자이너 페르소나**: Playful, Warm

## 한줄 요약

경북대 학우끼리 일회성 취미 모임(공강/주말 맛집·스포츠 등)을 가볍게 매칭하는 플랫폼.

## 핵심 시나리오

1. **방장**: "오늘 18시 북문 마라탕 3명" 글 작성 (일시, 장소, 인원, 태그, 오픈채팅 링크)
2. **참여자**: 매칭 신청 → 정원 마감 순간 알림 + 오픈채팅 링크 공개
3. **노쇼**: 약속 안 나타나면 신고 → 패널티

## DB 테이블 (5개)

- `Users` (학번, 닉네임, 비번, 노쇼 횟수)
- `Posts` (방장, 제목, 본문, 모임시간, 현재인원, 정원, 오픈채팅, 상태)
- `Post_Tags` (게시글-태그 다대다)
- `Applications` (게시글-신청자 다대다)
- `Notifications` (유저, 게시글, 종류, 메시지)

## 핵심 API (12개)

- 회원/인증: 학번 중복확인, 닉네임 중복확인, 회원가입, 로그인
- 게시글 CRUD: 작성, 삭제, 리스트 조회, 상세 조회
- 매칭: 신청, 신청 취소
- 알림 / 마이페이지

## 🔥 핵심 챌린지

### Race Condition (백엔드)

- 남은 1자리에 2명 동시 신청 → **1명만 성공해야**
- 해결: Prisma 트랜잭션 + row-level lock, 또는 낙관적 동시성 + 재시도

### 오픈채팅 프라이버시 (Security)

- 매칭 완료 전엔 API 응답이나 F12 개발자도구 어디서도 오픈채팅 링크 노출 X
- 매칭 완료 후에만 알림 API 응답에 포함
- 방장 본인은 항상 볼 수 있음 (작성한 사람)

### 신청 취소 롤백

- 신청 취소 → `current_capacity` 1 감소 + 게시글 상태 'RECRUITING'으로 롤백

### 노쇼 카운트

- 신고 → 신고당한 유저의 마이페이지에 `no_show_count +1`
- 일정 횟수 초과 시 일시 이용 정지 정책 (정책은 PO와 협의)

## 우선순위 에이전트

PO > BE > DBA > Security > QA > FE > Designer

## 노션 참고

- 프로젝트: <https://knu-getit.notion.site/363694c484f780eb9b8cd17b1423b077>
- PRD: <https://knu-getit.notion.site/PRD-363694c484f781398328d78b6a6d52bf>
- API: <https://knu-getit.notion.site/API-363694c484f78122bb7cd07dcc20f22c>
- ERD: <https://knu-getit.notion.site/DB-ERD-363694c484f781dc9e16f323530078fd>
- QA: <https://knu-getit.notion.site/QA-Checklist-363694c484f7813aa21cf26d3c73262d>
