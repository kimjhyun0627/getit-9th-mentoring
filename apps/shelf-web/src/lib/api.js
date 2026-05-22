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
 * 검색 응답 — items 배열 + pagination meta.
 *
 * #527: PR #526 의 client-side slice 무한 스크롤이 BE 한 번 호출에 10개만 받아오는
 * 한계를 노출해 무한 스크롤이 무용지물이었음. BE 가 카카오 page/size 를 그대로 노출하고
 * isEnd/totalCount 를 같이 내려주도록 변경 → FE 는 `useInfiniteQuery` 로 진짜
 * 페이지네이션 fetch 한다.
 *
 * 각 책은 외부 출처(KAKAO 등) → record 허용. passthrough 로 BE 가 필드 늘려도 안 깨짐.
 * 잘못된 형태가 오면 schema parse 에러 → 호출자가 catch 해서 에러 토스트 노출.
 */
const bookItemSchema = z.record(z.unknown());
const searchResponseSchema = z.object({
  items: z.array(bookItemSchema).default([]),
  page: z.number().int().min(1).default(1),
  size: z.number().int().min(1).default(30),
  isEnd: z.boolean().default(true),
  totalCount: z.number().int().min(0).default(0),
});

// CR #353: 신규 응답도 경계에서 최소 스키마 검증 → 화면까지 깨진 응답 전파 차단.
// passthrough 로 추가 필드는 허용 (BE 가 후에 필드 늘려도 FE 안 깨짐).
const bookSchema = z.record(z.unknown());
const shelfRowSchema = z.record(z.unknown());
const paginationSchema = z
  .object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).default(20),
    total: z.number().int().min(0).default(0),
    sort: z.string().optional(),
  })
  .passthrough();

const bookResponseSchema = z.object({ book: bookSchema });
const ownersResponseSchema = z.object({
  isbn: z.string(),
  count: z.number().int().min(0).default(0),
});
const recsResponseSchema = z.object({
  isbn: z.string(),
  author: z.string().default(''),
  items: z.array(bookSchema).default([]),
});
const userShelvesResponseSchema = z.object({
  userId: z.string(),
  shelves: z.array(shelfRowSchema).default([]),
  pagination: paginationSchema,
});

// #561 — 부원 디렉토리. 책 권 수만 노출, 책 목록 미노출.
const browseUserSchema = z.object({
  userId: z.string(),
  nickname: z.string(),
  bookCount: z.number().int().min(0),
});
const browseUsersResponseSchema = z.object({
  users: z.array(browseUserSchema).default([]),
  pagination: paginationSchema,
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
   * 도서 검색 — KAKAO API page/size 직통 (#527).
   *
   * @param {string} q
   * @param {{
   *   target?: 'title' | 'person' | 'publisher' | 'isbn';
   *   page?: number;
   *   size?: number;
   * }} [opts]
   * @returns {Promise<{
   *   items: Array<Record<string, unknown>>;
   *   page: number;
   *   size: number;
   *   isEnd: boolean;
   *   totalCount: number;
   * }>}
   */
  searchBooks: async (q, opts = {}) => {
    /** @type {Record<string, string | number>} */
    const params = { q };
    if (opts.target) params.target = opts.target;
    // CR #528: 0/NaN 같은 비정상 입력이 falsy 로 조용히 누락되면 BE 검증을 우회한다.
    // 전달 여부 기준(`!== undefined`)으로 검사해 BE 가 400 으로 명시적 거절.
    if (opts.page !== undefined) params.page = opts.page;
    if (opts.size !== undefined) params.size = opts.size;
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

  /**
   * 책 상세 (캐시 + 외부) — #201.
   * Zod 로 응답 경계 파싱 (CR #353).
   *
   * @param {string} isbn
   * @returns {Promise<{ data: { book: Record<string, unknown> } }>}
   */
  getBook: async (isbn) => {
    const res = await client.get(`/books/${encodeURIComponent(isbn)}`);
    return { ...res, data: bookResponseSchema.parse(res.data ?? {}) };
  },

  /**
   * 동일 책을 서재에 가진 유저 수 — #201, #292.
   *
   * @param {string} isbn
   * @returns {Promise<{ data: { isbn: string, count: number } }>}
   */
  getBookOwners: async (isbn) => {
    const res = await client.get(`/books/${encodeURIComponent(isbn)}/owners`);
    return { ...res, data: ownersResponseSchema.parse(res.data ?? {}) };
  },

  /**
   * 같은 작가 책 추천 — #209.
   *
   * @param {string} isbn
   * @returns {Promise<{ data: { isbn: string, author: string, items: Array<Record<string, unknown>> } }>}
   */
  getRecommendations: async (isbn) => {
    const res = await client.get(`/books/${encodeURIComponent(isbn)}/recommendations`);
    return { ...res, data: recsResponseSchema.parse(res.data ?? {}) };
  },

  /**
   * 다른 유저 서재 공개 조회 — #292.
   *
   * @param {string} userId
   * @param {{ page?: number; pageSize?: number; sort?: string }} [opts]
   */
  listUserShelves: async (userId, opts = {}) => {
    const res = await client.get(`/shelves/u/${encodeURIComponent(userId)}`, {
      params: { page: opts.page, pageSize: opts.pageSize, sort: opts.sort },
    });
    return { ...res, data: userShelvesResponseSchema.parse(res.data ?? {}) };
  },

  /**
   * 부원 서재 디렉토리 — #561.
   * 다른 사용자 서재 발견 경로. 책 권 수만 노출, 책 목록은 `/u/:userId` 에서.
   *
   * @param {{ page?: number; pageSize?: number; sort?: 'bookCount' | 'recent' }} [opts]
   * @returns {Promise<{ data: {
   *   users: Array<{ userId: string; nickname: string; bookCount: number }>;
   *   pagination: { page: number; pageSize: number; total: number; sort?: string };
   * } }>}
   */
  listBrowseUsers: async (opts = {}) => {
    const res = await client.get('/shelves/browse', {
      params: { page: opts.page, pageSize: opts.pageSize, sort: opts.sort },
    });
    return { ...res, data: browseUsersResponseSchema.parse(res.data ?? {}) };
  },

  /**
   * 내가 특정 책을 보유 중인지 lightweight lookup — #477.
   * 100건 myShelves 페이지 한계를 우회 (heavy-user 케이스).
   *
   * @param {{ bookId?: string; isbn?: string; bookIds?: string[]; isbns?: string[] }} q
   * @returns {Promise<{ data: { contains: boolean | Record<string, boolean>, shelf?: Record<string, unknown> } }>}
   */
  containsInShelf: async (q) => {
    const params = {};
    if (q.bookId) params.bookId = q.bookId;
    if (q.isbn) params.isbn = q.isbn;
    if (q.bookIds?.length) params.bookIds = q.bookIds.join(',');
    if (q.isbns?.length) params.isbns = q.isbns.join(',');
    const res = await client.get('/shelves/me/contains', { params });
    return res;
  },
};
