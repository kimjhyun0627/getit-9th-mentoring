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
 * 401 시 상위 콜백 실행 (옵션).
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
};
