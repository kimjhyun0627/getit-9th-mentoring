/**
 * 모집 게시글 (posts) 도메인 API.
 *
 * GET    /api/posts            — 리스트 (cursor 페이지네이션)
 * GET    /api/posts/:id        — 단건 상세
 * POST   /api/posts            — 작성
 * PATCH  /api/posts/:id        — 수정 (owner only, #333)
 * POST   /api/posts/:id/close  — 종료 (owner only, #244)
 */
import { client } from './api.core.js';
import { assertListShape, buildListParams } from './api.helpers.js';

/**
 * GET /api/posts — 모집 게시글 리스트. cursor 페이지네이션.
 *
 * @param {{ status?: string; tag?: string; cursor?: string; limit?: number }} [params]
 * @returns {Promise<import('./api.types.js').PostListResponse>}
 */
export const listPosts = async (params = {}) => {
  // JSON shape (HTML / 문자열 / null) 은 글로벌 interceptor 에서 이미 검증됨.
  // 여기서는 리스트 전용 shape (items 가 배열) 만 추가로 본다.
  const res = await client.get('/posts', { params: buildListParams(params) });
  assertListShape(res.data);
  return res.data;
};

/**
 * GET /api/posts/:id — 단건 상세. JWT 쿠키가 있으면 owner 판정.
 *
 * @param {string} id
 * @returns {Promise<import('./api.types.js').PostDetailResponse>}
 */
export const getPost = async (id) => {
  const res = await client.get(`/posts/${encodeURIComponent(id)}`);
  return res.data;
};

/**
 * 게시글 작성. 다른 도메인 함수와 동일하게 `res.data` 만 반환 — 호출자는
 * `{ post: {...} }` 형태를 직접 다룬다.
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
export const createPost = async (body) => {
  const res = await client.post('/posts', body);
  return res.data;
};

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
export const updatePost = async (id, patch) => {
  const res = await client.patch(`/posts/${encodeURIComponent(id)}`, patch);
  return res.data;
};

/**
 * 게시글 종료 (CLOSED 전이, owner only) — #244.
 *
 * @param {string} id
 */
export const closePost = async (id) => {
  const res = await client.post(`/posts/${encodeURIComponent(id)}/close`);
  return res.data;
};
