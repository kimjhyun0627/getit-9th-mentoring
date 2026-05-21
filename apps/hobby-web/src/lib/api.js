import axios from 'axios';

import { assertJsonObject, assertListShape, buildListParams, onSuccess } from './api.helpers.js';
import { makeOnError, refreshAccessToken } from './api.refresh.js';

// re-export — 기존 외부 호출자 호환 (다른 파일에서 `import { assertJsonObject } from './api'` 사용 가능).
export { assertJsonObject, assertListShape };

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

client.interceptors.response.use(onSuccess, makeOnError(client, handlers));

// JSDoc typedef (PostItem / PostListResponse / PostDetailResponse / ApplicationResponse / MeResponse)
// 는 api.types.js, assertJsonObject / onSuccess / buildListParams / assertListShape 는
// api.helpers.js 로 분리 — file size cap 안에 들어가도록.

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
   * @returns {Promise<import('./api.types.js').PostListResponse>}
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
   *   applicationPolicy?: 'FIRST_COME' | 'APPROVAL';
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
   *   applicationPolicy: 'FIRST_COME' | 'APPROVAL';
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
   * #500: 응답에 `applicationPolicy` + `items[].status` 포함.
   *
   * @param {string} id
   * @returns {Promise<{ items: Array<{
   *   id: string;
   *   userId: string;
   *   status: 'PENDING' | 'APPROVED' | 'REJECTED';
   *   createdAt: string;
   *   noShow: boolean;
   *   noShowCount: number;
   * }>; total: number; applicationPolicy: 'FIRST_COME' | 'APPROVAL' }>}
   */
  listApplicants: async (id) => {
    const res = await client.get(`/posts/${encodeURIComponent(id)}/applicants`);
    return res.data;
  },

  /**
   * 신청 승인 (방장, APPROVAL 정책) — #500/#502.
   *
   * @param {string} applicationId
   */
  approveApplication: async (applicationId) => {
    const res = await client.patch(`/applications/${encodeURIComponent(applicationId)}/approve`);
    return res.data;
  },

  /**
   * 신청 거절 (방장, APPROVAL 정책) — #500/#502.
   *
   * @param {string} applicationId
   */
  rejectApplication: async (applicationId) => {
    const res = await client.patch(`/applications/${encodeURIComponent(applicationId)}/reject`);
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
   * @returns {Promise<import('./api.types.js').PostDetailResponse>}
   */
  getPost: async (id) => {
    const res = await client.get(`/posts/${encodeURIComponent(id)}`);
    return res.data;
  },

  /**
   * POST /api/applications — 매칭 신청. JWT 필요.
   *
   * @param {string} postId
   * @returns {Promise<import('./api.types.js').ApplicationResponse>}
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
   * @returns {Promise<import('./api.types.js').MeResponse>}
   */
  getMe: async () => {
    // Cache-Control: no-cache — 라이브 버그 대응 (auth-api 가 304 보내면 axios 응답
    // 의 data 가 undefined/이전 캐시로 흘러 invalid /me response throw). BE 도
    // Cache-Control: no-store 보내지만 클라이언트도 명시해 conditional GET 차단.
    const res = await authClient.get('/me', { headers: { 'Cache-Control': 'no-cache' } });
    const user = res.data?.user ?? res.data ?? null;
    if (!user || typeof user !== 'object') throw new Error('invalid /me response');
    const rawId = user.id ?? user.sub;
    if (typeof rawId !== 'string' || rawId.length === 0) {
      throw new Error('invalid /me response: missing id');
    }
    return { id: rawId, email: user.email, name: user.name };
  },
};
