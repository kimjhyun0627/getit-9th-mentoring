/**
 * hobby-web api 응답 타입 정의 — JSDoc typedef 만 모음.
 * 분리 이유: api.js 가 300줄 cap 안에 들어가도록.
 *
 * 사용: 다른 파일에서 `@type {import('./api.types.js').PostItem}` 형식으로 참조.
 */

/**
 * 모집 게시글 (`/api/posts` 리스트 / `/api/posts/:id` 단건 응답 공통 형태).
 *
 * @typedef {object} PostItem
 * @property {string} id - 게시글 id (cuid)
 * @property {string} ownerId - 방장 user id
 * @property {string} title - 제목
 * @property {string} body - 본문
 * @property {string} meetAt - 모임 일시 (ISO 8601)
 * @property {number} capacity - 정원
 * @property {number} currentCapacity - 현재 신청자 수
 * @property {'RECRUITING' | 'FULL' | 'CLOSED'} status - 모집 상태
 * @property {'FIRST_COME' | 'APPROVAL'} [applicationPolicy] - 신청 정책 (#500)
 * @property {string} createdAt - 생성 시각 (ISO 8601)
 * @property {string} updatedAt - 수정 시각 (ISO 8601)
 * @property {Array<{ id: string; name: string }>} tags - 태그 목록
 * @property {string} [openChatUrl] - 오픈채팅 URL (방장 OR FULL 일 때만 응답에 포함)
 */

/**
 * 리스트 응답.
 *
 * @typedef {object} PostListResponse
 * @property {PostItem[]} items - 카드 아이템
 * @property {string | null} nextCursor - 다음 페이지 cursor (없으면 null)
 */

/**
 * 단건 조회 응답.
 *
 * @typedef {object} PostDetailResponse
 * @property {PostItem} post - 게시글 본체
 */

/**
 * 매칭 신청 응답.
 *
 * @typedef {object} ApplicationResponse
 * @property {{
 *   id: string;
 *   postId: string;
 *   userId: string;
 *   status?: 'PENDING' | 'APPROVED' | 'REJECTED';
 *   createdAt: string;
 * }} application - 새로 생성된 신청 row
 */

/**
 * 현재 로그인 사용자 응답. 비로그인이면 401.
 *
 * @typedef {object} MeResponse
 * @property {string} id - user id (= JWT sub)
 * @property {string} [email] - 이메일 (있을 수도)
 * @property {string} [name] - 이름 (있을 수도)
 * @property {string | null} [schoolVerifiedAt] - 학교 인증 완료 시각 (ISO). 미인증이면 null. (#541)
 */

export {};
