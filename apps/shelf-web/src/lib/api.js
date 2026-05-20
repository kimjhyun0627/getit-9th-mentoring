import axios from 'axios';

/**
 * shelf-web 전용 axios 인스턴스.
 * - baseURL: VITE_API_URL 우선, 없으면 '/api' (prod 동일 origin 가정)
 * - withCredentials: true — JWT는 HttpOnly 쿠키. .get-it.cloud 도메인 공유.
 */
const baseURL = import.meta.env?.VITE_API_URL ?? '/api';

export const client = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 10000,
});

/**
 * 401 시 상위 콜백 실행 (옵션). 현재는 미사용. 로그인 화면 redirect는 추후.
 *
 * @type {{ onUnauthorized: (() => void) | null }}
 */
const handlers = { onUnauthorized: null };

/**
 * 401 콜백 등록.
 *
 * @param {() => void} fn
 */
export const setUnauthorizedHandler = (fn) => {
  handlers.onUnauthorized = fn;
};

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && handlers.onUnauthorized) {
      handlers.onUnauthorized();
    }
    return Promise.reject(err);
  },
);

/**
 * 서재 API — 페이지에서 axios 직접 노출 X.
 *
 * GET /shelves/me, PATCH /shelves/:bookId, DELETE /shelves/:bookId 백엔드 매핑.
 */
export const api = {
  /**
   * @param {{ page?: number; pageSize?: number }} [opts]
   */
  listMyShelves: (opts = {}) =>
    client.get('/shelves/me', { params: { page: opts.page, pageSize: opts.pageSize } }),
  /**
   * @param {string} bookId
   * @param {{ status?: 'WANT'|'READING'|'READ'; rating?: number|null; review?: string|null }} body
   */
  updateShelf: (bookId, body) => client.patch(`/shelves/${encodeURIComponent(bookId)}`, body),
  /**
   * @param {string} bookId
   */
  removeShelf: (bookId) => client.delete(`/shelves/${encodeURIComponent(bookId)}`),
};
