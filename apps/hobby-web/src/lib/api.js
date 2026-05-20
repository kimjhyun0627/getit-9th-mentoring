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
};
