import axios from 'axios';

/**
 * board-web 전용 axios 인스턴스.
 * - baseURL: VITE_API_URL 우선, 없으면 '/api' (prod 동일 origin 가정)
 * - withCredentials: true — JWT는 HttpOnly 쿠키. `.get-it.cloud` 도메인 공유 (SSO).
 */
const baseURL = import.meta.env?.VITE_API_URL ?? '/api';

export const client = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 10000,
});

/**
 * 401 시 상위 콜백 실행 (옵션). 보통 auth.get-it.cloud 로 redirect.
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
 * board-api 호출 헬퍼.
 * 모든 엔드포인트는 `/projects` 하위. 인증은 HttpOnly 쿠키 (`withCredentials`).
 */
export const api = {
  /** 내가 멤버인 프로젝트 목록. */
  listProjects: () => client.get('/projects'),
  /**
   * 프로젝트 생성 (OWNER로 등록 + Todo/Doing/Done 컬럼 자동 생성).
   *
   * @param {{ name: string; description?: string }} body
   */
  createProject: (body) => client.post('/projects', body),
};
