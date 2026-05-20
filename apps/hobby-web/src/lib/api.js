import axios from 'axios';

/**
 * hobby-web 전용 axios 인스턴스.
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
 * GET /api/posts query string 빌더.
 *
 * @param {{ status?: string; tag?: string; cursor?: string; limit?: number }} params
 * @returns {Record<string, string|number>}
 */
const buildListParams = (params) => {
  const out = {};
  if (params.status) out.status = params.status;
  if (params.tag) out.tag = params.tag;
  if (params.cursor) out.cursor = params.cursor;
  if (params.limit) out.limit = params.limit;
  return out;
};

/**
 * 모집 게시글 리스트 응답 아이템.
 *
 * @typedef {object} PostListItem
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
 * @property {string} [openChatUrl] - 오픈채팅 URL (매칭 완료 후 + 방장만 노출)
 */

/**
 * 리스트 응답.
 *
 * @typedef {object} PostListResponse
 * @property {PostListItem[]} items - 카드 아이템
 * @property {string | null} nextCursor - 다음 페이지 cursor (없으면 null)
 */

/**
 * 단건 조회 응답 — 방장이거나 status === 'FULL' 일 때만 `openChatUrl` 포함.
 *
 * @typedef {object} PostDetailResponse
 * @property {PostListItem} post - 게시글 본체
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

export const api = {
  /**
   * GET /api/posts — 모집 게시글 리스트. cursor 페이지네이션.
   *
   * @param {{ status?: string; tag?: string; cursor?: string; limit?: number }} [params]
   * @returns {Promise<PostListResponse>}
   */
  listPosts: async (params = {}) => {
    const res = await client.get('/posts', { params: buildListParams(params) });
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
   * @returns {Promise<MeResponse>}
   */
  getMe: async () => {
    const res = await authClient.get('/me');
    return res.data;
  },
};
