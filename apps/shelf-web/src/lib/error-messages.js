/**
 * 에러 메시지 카탈로그 — Editorial 격식 톤 통일 (#483).
 *
 * 페이지마다 약간씩 다른 톤 (반말/격식체) 이 섞여 있던 것을 한 파일로 모아 정리한다.
 * 책/서가 메타포 + 격식체 (#118, #144 라운드 결정) 를 일관 적용.
 *
 * 사용:
 *   import { shelfError, bookError, searchError, userShelfError } from '../lib/error-messages';
 *   const message = shelfError(err);
 */

/**
 * Axios 스타일 에러 객체에서 status 코드만 안전하게 뽑아낸다.
 *
 * @param {unknown} err
 * @returns {number | undefined}
 */
const statusOf = (err) => {
  const candidate = /** @type {{ response?: { status?: number } }} */ (err);
  const status = candidate?.response?.status;
  return typeof status === 'number' ? status : undefined;
};

/**
 * 내 서재 (HomePage) — 목록 로드 / PATCH / DELETE 에 사용.
 *
 * @param {unknown} err
 * @returns {string}
 */
export const shelfError = (err) => {
  const status = statusOf(err);
  if (status === 401) return '로그인이 필요합니다.';
  if (status === 404) return '서재에서 그 책을 찾을 수 없습니다.';
  if (status === 422) return '이미 서가에 꽂혀 있는 책입니다.';
  if (typeof status === 'number' && status >= 500)
    return '지금은 서가를 펼칠 수 없습니다. 잠시 후 다시 시도해 주세요.';
  return '서가를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
};

/**
 * 책 상세 (BookDetailPage) — GET /books/:isbn 로드 에러.
 *
 * @param {unknown} err
 * @returns {string}
 */
export const bookError = (err) => {
  const status = statusOf(err);
  if (status === 404) return '그 책은 이 서가에 없습니다.';
  if (status === 400) return '잘못된 ISBN 입니다.';
  if (typeof status === 'number' && status >= 500)
    return '잠시 책장에 손이 닿지 않습니다. 곧 다시 시도해 주세요.';
  return '책 정보를 펼치지 못했습니다.';
};

/**
 * 책 추가 (POST /shelves) — SearchPage / BookDetailPage 공용.
 *
 * @param {unknown} err
 * @returns {string}
 */
export const addBookError = (err) => {
  const status = statusOf(err);
  if (status === 422) return '이미 서가에 꽂혀 있는 책입니다.';
  if (status === 401) return '로그인이 필요합니다.';
  if (status === 404) return '그 책의 정보를 찾지 못했습니다.';
  if (typeof status === 'number' && status >= 500) return '잠시 후 다시 담아 주세요.';
  return '책을 서가에 담는 데 실패했습니다. 잠시 후 다시 시도해 주세요.';
};

/**
 * 도서 검색 (GET /books/search).
 *
 * @param {unknown} err
 * @returns {string}
 */
export const searchError = (err) => {
  const status = statusOf(err);
  if (status === 401) return '로그인이 필요합니다.';
  if (status === 503) return '도서 정보를 잠시 불러올 수 없습니다. 잠시 후 다시 펼쳐 주세요.';
  if (status === 400) return '검색어를 다시 살펴봐 주세요.';
  return '검색 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.';
};

/**
 * 다른 유저 공개 서재 (UserShelfPage).
 *
 * @param {unknown} err
 * @returns {string}
 */
export const userShelfError = (err) => {
  const status = statusOf(err);
  if (status === 400) return '잘못된 사용자 주소입니다.';
  if (status === 404) return '그 서가는 이 도서관에 없습니다.';
  if (typeof status === 'number' && status >= 500)
    return '지금은 서가를 펼칠 수 없습니다. 잠시 후 다시 시도해 주세요.';
  return '서가를 불러오지 못했습니다.';
};
