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
 * 페이지에서 axios 를 직접 다루지 않고 이 헬퍼만 import 한다.
 *
 * 참고: POST body 의 `meetAt` 은 BE Zod 가 ISO 8601 문자열 (offset 포함) 을
 * 요구. FE 에서 `<input type="datetime-local">` 의 로컬 시각을 그대로 보내면
 * tz 누락으로 거절되니, `new Date(local).toISOString()` 변환 필수.
 */
export const api = {
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
   * GET /api/posts — 모집 게시글 리스트. cursor 페이지네이션.
   *
   * @param {{ status?: string; tag?: string; cursor?: string; limit?: number }} [params]
   * @returns {Promise<PostListResponse>}
   */
  listPosts: async (params = {}) => {
    const res = await client.get('/posts', { params: buildListParams(params) });
    return res.data;
  },
};
