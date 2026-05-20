/**
 * createdAt → 한국어 상대 시간 ("방금", "N분 전", "M일 전", "YYYY-MM-DD").
 * Warm 시안의 손글씨 시간 표기와 동일한 분기 (board-web 의 formatUpdated 와 동등).
 *
 * @param {string | Date | null | undefined} value
 * @param {Date} [now] - 테스트용 주입 (deterministic).
 * @returns {string}
 */
export const formatRelative = (value, now = new Date()) => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = now.getTime() - d.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  const week = Math.floor(day / 7);
  if (week < 5) return `${week}주 전`;
  // 사용자 로컬 타임존 기준 YYYY-MM-DD (en-CA 로케일이 ISO 형식 보장).
  return d.toLocaleDateString('en-CA');
};

/**
 * 메시지 ID로 deterministic 회전각 도출 (-3°~+3°).
 * 무작위가 아니라 ID 해시 기반이라 리렌더에도 같은 카드는 같은 각도 유지.
 *
 * @param {string} id
 * @returns {number} -3 ~ 3 사이 소수 1자리 회전 각도 (deg).
 */
export const rotationFromId = (id) => {
  if (typeof id !== 'string' || id.length === 0) return 0;
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  // -30 ~ +30 → /10 으로 -3.0 ~ +3.0
  const bounded = (((hash % 61) + 61) % 61) - 30;
  return Math.round(bounded) / 10;
};
