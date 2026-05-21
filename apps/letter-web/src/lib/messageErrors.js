import { retryAfterSec } from './modalHelpers.js';

/**
 * letter-web 모달 (Compose / Edit) 공유 에러 매핑.
 *
 * Compose 와 Edit 모두 401 / 400 / 422 / 429 / 5xx 응답을 동일 카피로 안내한다.
 * 모달별로만 다른 부분:
 * - Compose: 401 "로그인 만료 → 다시 로그인한 뒤 *붙여*주세요" / 액션 동사 "붙이지"
 * - Edit: 403 "본인 쪽지만 수정", 404 "이미 떼어진 쪽지", 액션 동사 "수정"
 *
 * `composeError` / `editError` 두 헬퍼로 노출.
 */

/**
 * 429 응답이면 Retry-After 카운트다운 카피, 아니면 기본 rate-limit 카피.
 *
 * @param {unknown} err
 * @returns {string | null} 429 가 아니면 null
 */
const rateLimitMessage = (err) => {
  const sec = retryAfterSec(err);
  if (sec != null && sec > 0) return `잠시만요, ${sec}초 후 다시 시도해주세요`;
  return '잠시만요, 너무 빨리 보냈어요. 조금 있다 다시 시도해주세요';
};

/**
 * @param {unknown} err
 * @returns {number | undefined}
 */
const statusOf = (err) => /** @type {{response?: {status?: number}}} */ (err)?.response?.status;

/**
 * 메시지 생성 모달용 에러 매핑.
 *
 * @param {unknown} err
 * @returns {string}
 */
export const composeError = (err) => {
  const status = statusOf(err);
  if (status === 401) return '로그인이 만료됐어요. 다시 로그인한 뒤 붙여주세요';
  if (status === 400 || status === 422) return '입력 내용을 다시 확인해주세요';
  if (status === 429) return rateLimitMessage(err);
  if (typeof status === 'number' && status >= 500)
    return '서버가 잠깐 쉬는 중이에요. 잠시 후 다시 붙여주세요';
  return '쪽지를 붙이지 못했어요. 잠시 후 다시 시도해주세요';
};

/**
 * 메시지 수정 모달용 에러 매핑.
 *
 * @param {unknown} err
 * @returns {string}
 */
export const editError = (err) => {
  const status = statusOf(err);
  if (status === 401) return '로그인이 만료됐어요. 다시 로그인한 뒤 수정해주세요';
  if (status === 403) return '본인 쪽지만 수정할 수 있어요';
  if (status === 404) return '이미 떼어진 쪽지에요';
  if (status === 400 || status === 422) return '입력 내용을 다시 확인해주세요';
  if (status === 429) return rateLimitMessage(err);
  if (typeof status === 'number' && status >= 500)
    return '서버가 잠깐 쉬는 중이에요. 잠시 후 다시 시도해주세요';
  return '쪽지를 수정하지 못했어요. 잠시 후 다시 시도해주세요';
};
