/**
 * Message 직렬화 — 익명 롤링페이퍼 응답 변환.
 *
 * 분리 이유: messages.js 가 라우터 + 직렬화 + 권한 검증을 모두 안고 있어 책임 분리.
 * 다른 API (hobby-api `posts.serialize.js`) 와 네이밍/위치 컨벤션 통일.
 *
 * 익명성 invariant (Spec 핵심 — `.claude/projects/letter.md`):
 *  - ⚠️ authorId 응답 노출 금지 — 본인 식별은 `is_mine` boolean 만.
 *  - ⚠️ updatedAt 미노출 (#251): updatedAt !== createdAt 자체가 "편집됨" 시그널 →
 *    deanonymize 표면. DB 에는 유지 (admin/audit 용도).
 *  - ⚠️ createdAt 분 단위 truncate (#250): ms 정밀도 timing oracle 차단.
 */

/**
 * createdAt 을 분(minute) 단위로 라운딩한 ISO 문자열로 변환.
 *
 * 익명성 위협 (#250): ms 정밀도 timestamp 는 timing oracle.
 * 어떤 메시지가 "정확히 14:23:47.328Z 에 작성됐다" 는 시그널이 Slack/Discord
 * 활동 로그와 cross-reference 되면 30~50명 동아리에서 작성자 추측 가능.
 * 분 단위로 자르면 FE 의 `formatRelative` ("방금 전" / "N분 전") 표시는 그대로.
 *
 * @param {Date | string | null | undefined} v
 * @returns {string | null}
 */
export const truncateToMinuteISO = (v) => {
  if (v == null) return null;
  const src = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(src.getTime())) return null;
  // ⚠️ src 가 호출자의 row.createdAt 참조일 수 있어 절대 mutate 금지.
  // 새 Date 만들어 초/ms 만 0 처리. UTC 기준이라 tz drift 없음.
  const out = new Date(src.getTime());
  out.setUTCSeconds(0, 0);
  return out.toISOString();
};

/**
 * Message DB row → API 응답 직렬화.
 *
 * @param {object} row - prisma Message row
 * @param {string} viewerSub - JWT sub (본인 식별용)
 * @returns {object} 응답에 안전한 객체 (authorId 절대 미포함)
 */
export const serializeMessage = (row, viewerSub) => {
  const isMine = row.authorId === viewerSub;
  return {
    id: row.id,
    content: row.content,
    color: row.color,
    createdAt: truncateToMinuteISO(row.createdAt),
    is_mine: isMine,
  };
};
