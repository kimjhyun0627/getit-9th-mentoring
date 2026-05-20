/**
 * 모임 일시 표시 헬퍼.
 * - 오늘 → "오늘 HH:MM"
 * - 내일 → "내일 HH:MM"
 * - 그 외 → "M/D (요일) HH:MM"
 *
 * @param {string | Date} input - ISO 8601 문자열 또는 Date
 * @param {Date} [now] - 테스트용 주입
 * @returns {string}
 */
export const formatMeetAt = (input, now = new Date()) => {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOf(d) - startOf(now)) / 86400000);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (dayDiff === 0) return `오늘 ${hh}:${mm}`;
  if (dayDiff === 1) return `내일 ${hh}:${mm}`;
  const dayName = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()} (${dayName}) ${hh}:${mm}`;
};

/**
 * 닉네임 → 한 글자 이니셜 (한국어 이름이면 첫 음절 첫 자).
 * 공백만 들어와도 '?' fallback (trim 후 0자면 빈 카드 회피).
 *
 * @param {string} name
 * @returns {string}
 */
export const initialOf = (name) => {
  const trimmed = name?.trim?.() ?? '';
  if (!trimmed) return '?';
  return trimmed.charAt(0);
};
