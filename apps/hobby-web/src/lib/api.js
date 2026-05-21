import axios from 'axios';

import { makeOnError, refreshAccessToken } from './api.refresh.js';

/**
 * hobby-web 전용 axios 인스턴스.
 * - baseURL: VITE_API_URL 우선, 없으면 '/api' (prod 동일 origin 가정)
 * - withCredentials: true — JWT는 HttpOnly 쿠키. .get-it.cloud 도메인 공유.
 */
const baseURL = import.meta.env?.VITE_API_URL ?? '/api';

// re-export — 호출자가 api.js 한 곳만 import 하도록 유지 (test/HOC 호환).
export { refreshAccessToken };

export const client = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 10000,
});

/**
 * 401 시 상위 콜백 실행 (옵션). 작성 페이지에서 unauthorized 처리 용.
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

/**
 * 응답 본체가 진짜 JSON 형태인지 확인.
 *
 * BE 미기동 시 vite dev server 가 SPA fallback 으로 `/api/*` 요청에
 * `index.html` (HTML 문자열) 을 status 200 으로 응답하는 케이스가 실측됨 (issue #89).
 * axios 는 그대로 통과시켜 `res.data` 가 문자열이 되고, 이후 `.pages.flatMap` 등에서
 * undefined dereference 로 React 가 컴포넌트 전체 unmount → 빈 화면.
 *
 * 글로벌 interceptor 에서 호출돼 `client` / `authClient` 모든 요청에 적용된다.
 * 여기서 미리 throw 해서 react-query 의 `isError` 분기로 흘려보낸다.
 *
 * axios 1.x 는 응답 헤더 키를 소문자로 정규화하므로 `content-type` 만 본다.
 *
 * @param {unknown} data
 * @param {Record<string, string> | undefined} headers
 * @returns {void}
 */
export const assertJsonObject = (data, headers) => {
  const contentType = headers?.['content-type'] ?? '';
  if (typeof contentType === 'string' && contentType.includes('text/html')) {
    throw new Error('invalid response: expected JSON, got HTML (BE down?)');
  }
  if (typeof data === 'string') {
    throw new Error('invalid response: expected JSON object, got string');
  }
  if (data === null || typeof data !== 'object') {
    throw new Error('invalid response: expected JSON object');
  }
};

/**
 * 글로벌 응답 interceptor 핸들러.
 *
 * - 2xx 응답: JSON 검증 (HEAD/204 는 skip)
 * - 401 응답: onUnauthorized 콜백 (있으면) 발화
 *
 * @param {import('axios').AxiosResponse} res
 * @returns {import('axios').AxiosResponse}
 */
const onSuccess = (res) => {
  // 204 No Content / HEAD 응답은 body 가 없을 수 있어 검증 skip.
  if (res.status === 204 || res.config?.method?.toLowerCase() === 'head') {
    return res;
  }
  assertJsonObject(res.data, res.headers);
  return res;
};

client.interceptors.response.use(onSuccess, makeOnError(client, handlers));

/**
 * GET /api/posts query string 빌더.
 *
 * @param {{
 *   status?: string;
 *   tag?: string;
 *   q?: string;
 *   timeWindow?: 'all'|'today'|'week';
 *   cursor?: string;
 *   limit?: number;
 * }} params
 * @returns {Record<string, string|number>}
 */
const buildListParams = (params) => {
  const out = {};
  if (params.status) out.status = params.status;
  if (params.tag) out.tag = params.tag;
  if (params.q) out.q = params.q;
  if (params.timeWindow && params.timeWindow !== 'all') out.timeWindow = params.timeWindow;
  if (params.cursor) out.cursor = params.cursor;
  if (params.limit !== undefined) out.limit = params.limit;
  return out;
};

/**
 * 리스트 응답 shape 검증.
 * 호출 시점에 `data` 가 이미 JSON 객체임이 보장되므로 (interceptor), items 만 본다.
 *
 * @param {unknown} data
 * @returns {asserts data is PostListResponse}
 */
export const assertListShape = (data) => {
  const d = /** @type {{ items?: unknown }} */ (data);
  if (!Array.isArray(d.items)) {
    throw new Error('invalid response: items must be an array');
  }
};

/**
 * 모집 게시글 (`/api/posts` 리스트 / `/api/posts/:id` 단건 응답 공통 형태).
 *
 * @typedef {object} PostItem
 * @property {string} id - 게시글 id (cuid)
 * @property {string} ownerId - 방장 user id
 * @property {string} title - 제목
 * @property {string} body - 본문
 * @property {string} meetAt - 모임 일시 (ISO 8601)
 * @property {number} capacity - 정원
 * @property {number} currentCapacity - 현재 신청자 수
 * @property {'RECRUITING' | 'FULL' | 'CLOSED'} status - 모집 상태
 * @property {string} createdAt - 생성 시각 (ISO 8601)
 * @property {string} updatedAt - 수정 시각 (ISO 8601)
 * @property {Array<{ id: string; name: string }>} tags - 태그 목록
 * @property {string} [openChatUrl] - 오픈채팅 URL (방장 OR FULL 일 때만 응답에 포함)
 */

/**
 * 리스트 응답.
 *
 * @typedef {object} PostListResponse
 * @property {PostItem[]} items - 카드 아이템
 * @property {string | null} nextCursor - 다음 페이지 cursor (없으면 null)
 */

/**
 * 단건 조회 응답.
 *
 * @typedef {object} PostDetailResponse
 * @property {PostItem} post - 게시글 본체
 */

/**
 * 매칭 신청 응답.
 *
 * @typedef {object} ApplicationResponse
 * @property {{ id: string; postId: string; userId: string; createdAt: string }} application - 새로 생성된 신청
 */

/**
 * 현재 로그인 사용자 응답. 비로그인이면 401.
 *
 * @typedef {object} MeResponse
 * @property {string} id - user id (= JWT sub)
 * @property {string} [email] - 이메일 (응답에 포함될 수도 있음)
 * @property {string} [name] - 이름 (응답에 포함될 수도 있음)
 */

/**
 * auth-api 와 통신할 axios 인스턴스. VITE_AUTH_API_URL 우선,
 * 없으면 hobby-api 와 동일 origin (`/api`) 가정 (Traefik path-based routing 시).
 */
const authBaseURL = import.meta.env?.VITE_AUTH_API_URL ?? '/api';
const authClient = axios.create({
  baseURL: authBaseURL,
  withCredentials: true,
  timeout: 10000,
});

// `client` 와 동일 interceptor 적용 — getMe 등 auth 요청도 BE-down 시 fail-soft
// + 401 시 refresh + 재시도. 단 instance 가 다르므로 makeOnError 로 새로 만든다.
authClient.interceptors.response.use(onSuccess, makeOnError(authClient, handlers));

/**
 * 페이지에서 axios 를 직접 다루지 않고 이 헬퍼만 import 한다.
 *
 * 참고: POST body 의 `meetAt` 은 BE Zod 가 ISO 8601 문자열 (offset 포함) 을
 * 요구. FE 에서 `<input type="datetime-local">` 의 로컬 시각을 그대로 보내면
 * tz 누락으로 거절되니, `new Date(local).toISOString()` 변환 필수.
 */
export const api = {
  /**
   * GET /api/posts — 모집 게시글 리스트. cursor 페이지네이션.
   *
   * @param {{ status?: string; tag?: string; cursor?: string; limit?: number }} [params]
   * @returns {Promise<PostListResponse>}
   */
  listPosts: async (params = {}) => {
    // JSON shape (HTML / 문자열 / null) 은 글로벌 interceptor 에서 이미 검증됨.
    // 여기서는 리스트 전용 shape (items 가 배열) 만 추가로 본다.
    const res = await client.get('/posts', { params: buildListParams(params) });
    assertListShape(res.data);
    return res.data;
  },

  /**
   * GET /api/me/posts — 내가 만든 모임. JWT 필요.
   *
   * @param {{ cursor?: string; limit?: number; status?: string }} [params]
   */
  listMyPosts: async (params = {}) => {
    const res = await client.get('/me/posts', { params });
    assertListShape(res.data);
    return res.data;
  },

  /**
   * GET /api/me/applications — 내가 신청한 모임. JWT 필요.
   *
   * @param {{ cursor?: string; limit?: number }} [params]
   */
  listMyApplications: async (params = {}) => {
    const res = await client.get('/me/applications', { params });
    assertListShape(res.data);
    return res.data;
  },

  /**
   * GET /api/notifications — 본인 알림. JWT 필요.
   *
   * @param {{ cursor?: string; limit?: number; unreadOnly?: 'true'|'false' }} [params]
   */
  listNotifications: async (params = {}) => {
    const res = await client.get('/notifications', { params });
    assertListShape(res.data);
    return res.data;
  },

  /**
   * PATCH /api/notifications/:id/read — 단건 읽음 처리.
   *
   * @param {string} id
   */
  markNotificationRead: async (id) => {
    await client.patch(`/notifications/${encodeURIComponent(id)}/read`);
  },

  /**
   * POST /api/notifications/read-all — 본인 unread 일괄 읽음.
   */
  markAllNotificationsRead: async () => {
    const res = await client.post('/notifications/read-all');
    return res.data;
  },

  /**
   * 게시글 작성.
   *
   * @param {{
   *   title: string;
   *   body: string;
   *   meetAt: string;
   *   capacity: number;
   *   openChatUrl: string;
   *   tags: string[];
   * }} body
   */
  createPost: (body) => client.post('/posts', body),

  /**
   * 게시글 수정 (PATCH, owner only) — #333.
   *
   * @param {string} id
   * @param {Partial<{
   *   title: string;
   *   body: string;
   *   meetAt: string;
   *   capacity: number;
   *   openChatUrl: string;
   *   tags: string[];
   * }>} patch
   */
  updatePost: async (id, patch) => {
    const res = await client.patch(`/posts/${encodeURIComponent(id)}`, patch);
    return res.data;
  },

  /**
   * 게시글 종료 (CLOSED 전이, owner only) — #244.
   *
   * @param {string} id
   */
  closePost: async (id) => {
    const res = await client.post(`/posts/${encodeURIComponent(id)}/close`);
    return res.data;
  },

  /**
   * 신청자 목록 (owner only) — #245.
   *
   * @param {string} id
   * @returns {Promise<{ items: Array<{
   *   id: string;
   *   userId: string;
   *   createdAt: string;
   *   noShow: boolean;
   *   noShowCount: number;
   * }>; total: number }>}
   */
  listApplicants: async (id) => {
    const res = await client.get(`/posts/${encodeURIComponent(id)}/applicants`);
    return res.data;
  },

  /**
   * 노쇼 신고 (owner only) — #247.
   *
   * @param {string} id
   * @param {string[]} applicantIds
   */
  reportNoShows: async (id, applicantIds) => {
    const res = await client.post(`/posts/${encodeURIComponent(id)}/no-shows`, {
      applicantIds,
    });
    return res.data;
  },

  /**
   * GET /api/posts/:id — 단건 상세. JWT 쿠키가 있으면 owner 판정.
   *
   * @param {string} id
   * @returns {Promise<PostDetailResponse>}
   */
  getPost: async (id) => {
    const res = await client.get(`/posts/${encodeURIComponent(id)}`);
    return res.data;
  },

  /**
   * POST /api/applications — 매칭 신청. JWT 필요.
   *
   * @param {string} postId
   * @returns {Promise<ApplicationResponse>}
   */
  applyPost: async (postId) => {
    const res = await client.post('/applications', { postId });
    return res.data;
  },

  /**
   * DELETE /api/applications/:id — 신청 취소. 본인 application id 필요.
   *
   * @param {string} applicationId
   * @returns {Promise<void>}
   */
  cancelApplication: async (applicationId) => {
    await client.delete(`/applications/${encodeURIComponent(applicationId)}`);
  },

  /**
   * GET (auth-api) /api/me — 현재 사용자. 비로그인이면 401 reject.
   *
   * auth-api 응답은 `{ user: { sub, email, name } }`. FE 는 `id` 키로 다루는 게
   * 자연스러우니 여기서 한 번에 정규화 (`{ id, email, name }`).
   *
   * id 가 비어있으면 throw — 호출자가 "로그인됨" 으로 오인하지 않도록 strict.
   *
   * @returns {Promise<MeResponse>}
   */
  getMe: async () => {
    const res = await authClient.get('/me');
    const user = res.data?.user ?? res.data ?? null;
    if (!user || typeof user !== 'object') throw new Error('invalid /me response');
    const rawId = user.id ?? user.sub;
    if (typeof rawId !== 'string' || rawId.length === 0) {
      throw new Error('invalid /me response: missing id');
    }
    return { id: rawId, email: user.email, name: user.name };
  },
};
