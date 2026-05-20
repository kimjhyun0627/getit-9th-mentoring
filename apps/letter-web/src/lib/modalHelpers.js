/**
 * letter-web 모달 (Compose / Edit) 공유 헬퍼.
 *
 * - CONTENT_MAX / CONTENT_WARN: 글자수 카운터 임계값 (#281).
 * - retryAfterSec: 429 응답에서 RateLimit-Reset / Retry-After 초 파싱 (#326).
 *
 * ComposeModal / EditModal 이 거의 동일한 폼이라 분리. 라인 수 제약 (CLAUDE.md
 * 300 max) + DRY 양쪽 충족.
 */

export const CONTENT_MAX = 500;
export const CONTENT_WARN = 480;

/**
 * @param {number} len
 * @returns {string} tailwind 색 class
 */
export const counterColorClass = (len) =>
  len >= CONTENT_MAX
    ? 'text-red-600 dark:text-red-300'
    : len >= CONTENT_WARN
      ? 'text-peachDk dark:text-rose'
      : 'text-ink2/70 dark:text-beige2/70';

/**
 * 429 응답에서 RateLimit-Reset / Retry-After 헤더 → 남은 초.
 *
 * express-rate-limit standardHeaders 가 RateLimit-Reset (초 단위) 또는
 * Retry-After 를 보낸다. 둘 다 0~3600 정수 가정.
 *
 * @param {unknown} err
 * @returns {number | null}
 */
export const retryAfterSec = (err) => {
  const headers = /** @type {{ response?: { headers?: Record<string, string> } }} */ (err)?.response
    ?.headers;
  if (!headers) return null;
  const raw = headers['ratelimit-reset'] ?? headers['retry-after'];
  if (!raw) return null;
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 0 || n > 3600) return null;
  return n;
};
