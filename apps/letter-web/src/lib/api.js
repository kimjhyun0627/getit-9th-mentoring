import axios from 'axios';

/**
 * letter-web 전용 axios 인스턴스.
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
 * auth-api 와 통신할 axios 인스턴스 (#252, #305). VITE_AUTH_API_URL 우선,
 * 없으면 letter-api 와 동일 origin (`/api`) 가정 (Traefik path-based routing 시).
 * 익명 보드 진입 전 GET /api/me 핑 — 비로그인이면 401 → setUnauthorizedHandler 발화.
 */
const authBaseURL = import.meta.env?.VITE_AUTH_API_URL ?? '/api';
export const authClient = axios.create({
  baseURL: authBaseURL,
  withCredentials: true,
  timeout: 10000,
});

/**
 * 401 시 상위 콜백 실행 (옵션).
 *
 * @type {{ onUnauthorized: (() => void) | null }}
 */
const handlers = { onUnauthorized: null };

/**
 * 401 콜백 등록. `null` 을 넘기면 해제.
 *
 * @param {(() => void) | null} fn
 */
export const setUnauthorizedHandler = (fn) => {
  handlers.onUnauthorized = fn;
};

/**
 * @param {unknown} err
 * @returns {Promise<never>}
 */
const onError = (err) => {
  if (
    /** @type {{ response?: { status?: number } }} */ (err)?.response?.status === 401 &&
    handlers.onUnauthorized
  ) {
    handlers.onUnauthorized();
  }
  return Promise.reject(err);
};

client.interceptors.response.use((res) => res, onError);
// auth-api 응답도 동일하게 401 → onUnauthorized 발화. 비인증 진입을 board 뷰
// 마운트 직후에 잡으려면 getMe 호출이 401 이어도 redirect 가 발화돼야 함.
authClient.interceptors.response.use((res) => res, onError);

/**
 * @typedef {object} MeResponse
 * @property {{ sub: string; email?: string; name?: string }} user - JWT payload
 */

/**
 * 페이지에서 axios 를 직접 다루지 않고 이 헬퍼만 import 한다.
 *
 * BE 응답 (letter-api `/messages` 라우터):
 *  - POST   /api/messages         → 201 { message: {...} }
 *  - GET    /api/messages         → 200 { items: [...] }
 *  - PATCH  /api/messages/:id     → 200 { message: {...} }
 *  - DELETE /api/messages/:id     → 204
 */
export const api = {
  /**
   * 메시지 작성.
   *
   * @param {{
   *   content: string;
   *   color: 'PINK' | 'MINT' | 'LEMON' | 'LAVENDER';
   * }} body
   */
  createMessage: (body) => client.post('/messages', body),

  /** 메시지 목록 조회. */
  listMessages: () => client.get('/messages'),

  /**
   * 본인 메시지 수정.
   *
   * @param {string} id
   * @param {{ content?: string; color?: 'PINK' | 'MINT' | 'LEMON' | 'LAVENDER' }} patch
   */
  updateMessage: (id, patch) => client.patch(`/messages/${id}`, patch),

  /**
   * 본인 메시지 삭제.
   *
   * @param {string} id
   */
  deleteMessage: (id) => client.delete(`/messages/${id}`),

  /**
   * GET (auth-api) /api/me — 현재 사용자. 비로그인이면 401 → setUnauthorizedHandler
   * 가 SSO redirect. BoardPage 진입 시 호출 (#305).
   *
   * @returns {Promise<MeResponse>}
   */
  getMe: async () => {
    // Cache-Control: no-cache — 라이브 버그 대응. BE 304 시 응답 body 비어 user
    // 판정 실패 (landing 사고와 동일 root cause). conditional GET 자체를 차단.
    const res = await authClient.get('/me', { headers: { 'Cache-Control': 'no-cache' } });
    return res.data;
  },
};
