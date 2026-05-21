/**
 * Book 캐시 TTL 정책 + 신선도 판단.
 *
 * - TTL 은 `BOOK_CACHE_TTL_HOURS` 환경변수 (기본 24h) 기반.
 * - 음수/NaN 은 기본값으로 fallback (운영 사고 방어).
 * - `isFresh` 는 Prisma DateTime row 가 `cachedAt + TTL > now` 인지 판정.
 *
 * 라우터에서 cache hit + fresh → 즉시 반환, stale → 외부 재호출 + graceful degrade.
 */
const DEFAULT_TTL_HOURS = 24;

/**
 * 모듈 로드 시점에 한 번만 계산하는 캐시 TTL (ms).
 * 환경변수 `BOOK_CACHE_TTL_HOURS` 기반, 음수/NaN 은 기본값으로.
 */
export const BOOK_CACHE_TTL_MS = (() => {
  const raw = process.env.BOOK_CACHE_TTL_HOURS;
  // 순수 양의 정수 문자열만 허용. "24h", "1e2", "24.5" 등 운영 오타는 조용히
  // 잘못된 값으로 통과되지 않도록 정규식으로 strict 검증 후 fallback.
  const isPureInt = typeof raw === 'string' && /^\d+$/.test(raw);
  const n = isPureInt ? Number(raw) : Number.NaN;
  const hours = Number.isInteger(n) && n > 0 ? n : DEFAULT_TTL_HOURS;
  return hours * 60 * 60 * 1000;
})();

/**
 * 캐시 row 가 신선한지 (cachedAt + TTL > now).
 * Prisma 는 DateTime 을 Date 객체로 반환하므로 `getTime()` 만 호출.
 *
 * @param {{ cachedAt: Date }} row
 * @returns {boolean}
 */
export const isFresh = (row) => {
  return Date.now() - row.cachedAt.getTime() < BOOK_CACHE_TTL_MS;
};
