import { ShelfAddInput } from '@getit/schemas/shelf';
import axios from 'axios';
import { z } from 'zod';

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
 * 검색 응답 — items 배열만 강제. 각 책은 외부 출처(KAKAO 등) → record 허용.
 * 잘못된 형태가 오면 빈 배열로 fallback해 UI 폭주 방지.
 */
const bookItemSchema = z.record(z.unknown());
const searchResponseSchema = z.object({
  items: z.array(bookItemSchema).default([]),
});

/**
 * 서재 API — 페이지에서 axios 직접 노출 X.
 *
 * - listMyShelves / updateShelf / removeShelf — 내 서재 관리 (#44).
 * - searchBooks / addToShelf — 책 검색 + 서재 추가 (#43).
 *
 * 외부 데이터 경계에서 zod 로 런타임 검증해서 UI 상태 깨짐 방지.
 */
export const api = {
  /**
   * @param {{ page?: number; pageSize?: number; sort?: string }} [opts]
   */
  listMyShelves: (opts = {}) =>
    client.get('/shelves/me', {
      params: { page: opts.page, pageSize: opts.pageSize, sort: opts.sort },
    }),
  /**
   * @param {string} bookId
   * @param {{ status?: 'WANT'|'READING'|'READ'; rating?: number|null; review?: string|null }} body
   */
  updateShelf: (bookId, body) => client.patch(`/shelves/${encodeURIComponent(bookId)}`, body),
  /**
   * @param {string} bookId
   */
  removeShelf: (bookId) => client.delete(`/shelves/${encodeURIComponent(bookId)}`),

  /**
   * @param {string} q
   * @param {{ target?: 'title' | 'person' | 'publisher' | 'isbn' }} [opts]
   * @returns {Promise<{ items: Array<Record<string, unknown>> }>}
   */
  searchBooks: async (q, opts = {}) => {
    const params = opts.target ? { q, target: opts.target } : { q };
    const res = await client.get('/books/search', { params });
    return searchResponseSchema.parse(res.data ?? {});
  },

  /**
   * @param {{ isbn?: string; bookId?: string; status?: 'WANT'|'READING'|'READ'; rating?: number; review?: string | null }} body
   * @returns {Promise<import('axios').AxiosResponse<{ shelf: Record<string, unknown> }>>}
   */
  addToShelf: (body) => {
    const parsed = ShelfAddInput.parse(body);
    return client.post('/shelves', parsed);
  },
};
