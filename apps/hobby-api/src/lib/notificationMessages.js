/**
 * 알림 메시지 카피 — Playful 톤 일관성 (#437).
 *
 * 규칙:
 *  - 반말 통일 (-요/존댓말 X). 친구한테 말하듯.
 *  - 마침표 끝맺음 일관. 이모지는 메시지에 맞는 곳만.
 *  - 모임 제목은 「」 로 감쌈.
 *  - 한 곳에서 관리 — 카피 변경 시 라우터 N곳 안 고치도록.
 *
 * 카피 결정 근거:
 *  - MATCH_FULL: 잔치 톤. 이모지 🎉 로 가볍게.
 *  - POST_CLOSED: 마감 안내. 군더더기 없이.
 *  - NO_SHOW_REPORTED: 방장이 한 행동. 약간의 신중함 + 캐주얼 톤.
 */

const wrap = (title) => (title ? `「${title}」 ` : '');

/**
 * MATCH_FULL — 모집 마감 알림 (방장 + 신청자 전체).
 *
 * @param {string|undefined} title
 */
export const matchFullMessage = (title) => `${wrap(title)}모집이 마감됐어 🎉 오픈채팅으로 모여봐.`;

/**
 * POST_CLOSED — 방장이 모임을 수동 종료. 신청자 전체에게.
 *
 * @param {string|undefined} title
 */
export const postClosedMessage = (title) => `${wrap(title)}모집이 종료됐어.`;

/**
 * NO_SHOW_REPORTED — 방장이 본인을 노쇼로 신고. 당사자에게만.
 *
 * @param {string|undefined} title
 */
export const noShowReportedMessage = (title) => `${wrap(title)}모임에서 방장이 노쇼로 신고했어.`;

/**
 * APPLICATION_PENDING — 새 신청 도착 (방장에게).
 *
 * @param {string|undefined} title
 */
export const applicationPendingMessage = (title) =>
  `${wrap(title)}모임에 새 신청이 도착했어. 승인할지 확인해줘 ✋`;

/**
 * APPLICATION_APPROVED — 신청 승인 (신청자에게).
 *
 * @param {string|undefined} title
 */
export const applicationApprovedMessage = (title) =>
  `${wrap(title)}모임에 입장 확정 🎉 오픈채팅으로 모여봐.`;

/**
 * APPLICATION_REJECTED — 신청 거절 (신청자에게).
 *
 * @param {string|undefined} title
 */
export const applicationRejectedMessage = (title) =>
  `${wrap(title)}모임 신청이 받아들여지지 않았어. 다른 모임도 찾아봐.`;
