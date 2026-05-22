/**
 * 가입 일자 등 사용자 노출용 날짜 포맷터 (school-auth #547).
 *
 *  - ISO-8601 (`2026-05-01T09:00:00Z`) → `2026-05-01` (한국어 YYYY-MM-DD).
 *  - 입력이 string 이 아니거나 Date 파싱 실패 시 `—` (em dash) 반환.
 *  - UTC 기준 절단 — 사용자 로컬 타임존으로 변환하지 않는다 (가입 일자는 날짜 단위
 *    의미만 가지므로 절대 시점 통일이 낫다).
 *
 * `Intl.DateTimeFormat` 대신 단순 substring — testset 결정론 + 의존성 0.
 *
 * @param {unknown} iso
 * @returns {string}
 */
export const formatJoinedAt = (iso) => {
  if (typeof iso !== 'string' || iso.length === 0) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  // toISOString 은 항상 UTC. `2026-05-01T09:00:00.000Z` → `2026-05-01`.
  return d.toISOString().slice(0, 10);
};
