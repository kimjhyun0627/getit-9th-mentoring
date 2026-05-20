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
  timeout: 10_000,
});

/**
 * 401 시 상위 콜백 실행. 페이지가 호출하지 않으면 무시.
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
 * shelf 도메인 API 헬퍼.
 * - searchBooks: BE 중계 (외부 카카오 API). 키 1자 이상 필수, 100자 이하.
 * - addToShelf: 내 서재에 추가. isbn 또는 bookId 중 하나 필수.
 */
export const api = {
  /**
   * @param {string} q
   * @returns {Promise<import('axios').AxiosResponse<{ items: Array<Record<string, unknown>> }>>}
   */
  searchBooks: (q) => client.get('/books/search', { params: { q } }),

  /**
   * @param {{ isbn?: string; bookId?: string; status?: 'WANT'|'READING'|'READ'; rating?: number; review?: string | null }} body
   * @returns {Promise<import('axios').AxiosResponse<{ shelf: Record<string, unknown> }>>}
   */
  addToShelf: (body) => client.post('/shelves', body),
};
