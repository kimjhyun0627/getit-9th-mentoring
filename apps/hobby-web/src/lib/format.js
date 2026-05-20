// #318: 표시 시각은 항상 KST(UTC+9) 로 강제. 학우들이 다른 타임존(여행/유학)에서 봐도
// 모임 시간은 KST 기준으로 통일된다. Intl.DateTimeFormat 의 timeZone 옵션 사용.
const KST = 'Asia/Seoul';

/**
 * 주어진 Date 를 KST 기준의 { year, month, day, hour, minute, weekday } 로 분해.
 * Intl API 로 정확하게 timezone 변환 → 클라이언트 OS 타임존과 무관.
 *
 * @param {Date} d
 */
const partsInKst = (d) => {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: KST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return {
    year: Number.parseInt(parts.year, 10),
    month: Number.parseInt(parts.month, 10),
    day: Number.parseInt(parts.day, 10),
    hour: parts.hour === '24' ? 0 : Number.parseInt(parts.hour, 10),
    minute: Number.parseInt(parts.minute, 10),
    weekday: parts.weekday,
  };
};

const KST_WEEKDAY_KO = {
  Sun: '일',
  Mon: '월',
  Tue: '화',
  Wed: '수',
  Thu: '목',
  Fri: '금',
  Sat: '토',
};

/**
 * 모임 일시 표시 헬퍼 — KST 강제 (#318).
 * - 오늘 → "오늘 HH:MM (KST)"
 * - 내일 → "내일 HH:MM (KST)"
 * - 그 외 → "M/D (요일) HH:MM (KST)"
 *
 * `now` 도 KST 로 정규화해 day-diff 계산 → 자정 직전/직후 OS 타임존 차이로 인한
 * "오늘/내일" 오표시 차단.
 *
 * @param {string | Date} input - ISO 8601 문자열 또는 Date (UTC)
 * @param {Date} [now] - 테스트용 주입
 * @returns {string}
 */
export const formatMeetAt = (input, now = new Date()) => {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const dp = partsInKst(d);
  const np = partsInKst(now);
  // KST 기준 자정-단위 day-diff (월/일 차이로 계산).
  const dDate = new Date(Date.UTC(dp.year, dp.month - 1, dp.day));
  const nDate = new Date(Date.UTC(np.year, np.month - 1, np.day));
  const dayDiff = Math.round((dDate.getTime() - nDate.getTime()) / 86400000);
  const hh = String(dp.hour).padStart(2, '0');
  const mm = String(dp.minute).padStart(2, '0');
  const time = `${hh}:${mm} (KST)`;
  if (dayDiff === 0) return `오늘 ${time}`;
  if (dayDiff === 1) return `내일 ${time}`;
  const dayName = KST_WEEKDAY_KO[dp.weekday] ?? '';
  return `${dp.month}/${dp.day} (${dayName}) ${time}`;
};

/**
 * 닉네임 → 한 글자 이니셜 (한국어 이름이면 첫 음절 첫 자).
 * 공백/null/undefined 도 안전하게 '?' fallback (trim 후 0자면 빈 카드 회피).
 *
 * @param {string | null | undefined} name
 * @returns {string}
 */
export const initialOf = (name) => {
  const trimmed = name?.trim?.() ?? '';
  if (!trimmed) return '?';
  return trimmed.charAt(0);
};
