/**
 * 게시글 list 의 meetAt 범위 필터 — KST 자정 boundary 기반.
 *
 * KST UTC+9 — 사용자 체감은 한국 시간 기준이지만 DB 는 UTC 저장.
 * 한국 자정 = UTC 15:00 (전날). 정확성을 위해 9시간 오프셋으로 자정 boundary 계산.
 *
 * @param {'all'|'today'|'week'} window
 * @param {Date} now
 * @returns {{ gte?: Date, lt?: Date } | null}
 */
export const meetAtRangeFor = (window, now) => {
  if (window === 'all') return null;
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  // now 를 KST 로 옮긴 뒤 자정 boundary 를 잡고 다시 UTC 로 환산.
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const kstMidnight = new Date(
    Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()),
  );
  const startUtc = new Date(kstMidnight.getTime() - KST_OFFSET_MS);
  if (window === 'today') {
    const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
    return { gte: startUtc, lt: endUtc };
  }
  // 'week' — 오늘 자정부터 7일 뒤 자정 직전까지.
  const endUtc = new Date(startUtc.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { gte: startUtc, lt: endUtc };
};
