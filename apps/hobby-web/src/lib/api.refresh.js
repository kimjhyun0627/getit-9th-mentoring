/**
 * 401 → /api/refresh → 재시도 인터셉터 로직 (#402).
 *
 * 라이브에서 access token TTL 이 15m 라 사용자가 페이지 둘러보다 만료되면
 * 모든 authed endpoint 가 401 을 반환했다. FE 에 refresh 로직이 없어 사용자는
 * "데이터 로드 안 됨" 상태로 갇혔다.
 *
 * 이 모듈:
 *  - `refreshAccessToken()`: `https://auth.get-it.cloud/api/refresh` 호출.
 *    in-flight promise 를 공유해 동시 401 들이 single-fire 가 되도록 보장.
 *  - `makeOnError(instance)`: axios response interceptor onError 팩토리.
 *    401 응답 + 첫 재시도 + non-refresh-call 일 때만 refresh 시도 후 원 요청을
 *    같은 instance 로 재발사. refresh 실패 시 onUnauthorized 콜백 + reject.
 *
 * NOTE: `refreshAccessToken` 은 일반 함수 — `async` 키워드로 만들면 호출자가
 * 받는 wrapping promise 가 매번 새로 만들어져 in-flight 공유가 깨진다
 * (Object.is 비교가 어긋남). 내부 IIFE promise 를 그대로 반환해야 reference
 * 가 보장된다.
 */
import axios from 'axios';

/** @type {Promise<void> | null} */
let refreshInFlight = null;

const refreshClient = axios.create({
  baseURL: import.meta.env?.VITE_AUTH_API_URL ?? 'https://auth.get-it.cloud/api',
  withCredentials: true,
  timeout: 10000,
});

/**
 * `/api/refresh` 호출. 성공 시 새 access cookie 가 세팅된다.
 * 다발 호출은 in-flight promise 로 묶어 한 번만 발사.
 *
 * @returns {Promise<void>}
 */
export const refreshAccessToken = () => {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      await refreshClient.post('/refresh');
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
};

/**
 * 401 응답을 받았을 때 refresh + 재시도 한 번을 보장하는 interceptor 핸들러 팩토리.
 *
 * instance 별로 만들어야 baseURL 이 다른 client / authClient 가 자기 자신으로
 * 재시도한다 (`client.request(config)` 에 다른 instance config 를 넘기면
 * baseURL 이 섞임).
 *
 * @param {import('axios').AxiosInstance} instance
 * @param {{ onUnauthorized?: (() => void) | null }} handlers
 * @returns {(err: unknown) => Promise<never | import('axios').AxiosResponse>}
 */
export const makeOnError = (instance, handlers) => async (err) => {
  const axiosErr = /** @type {{ response?: { status?: number }, config?: any }} */ (err);
  const status = axiosErr?.response?.status;
  const config = axiosErr?.config;

  // refresh 자체의 401 — 재시도 하지 않음 (= 진짜 expired refresh, SSO 로 가야 함).
  const url = String(config?.url ?? '');
  const isRefreshCall = url.endsWith('/refresh');

  if (status === 401 && config && !config._retry && !isRefreshCall) {
    config._retry = true;
    try {
      await refreshAccessToken();
      // 새 access cookie 받았으니 원 요청을 같은 instance 로 재시도.
      return instance.request(config);
    } catch {
      // refresh 실패 → 아래 onUnauthorized 콜백 + reject 흐름으로 fall-through.
    }
  }

  if (status === 401 && handlers.onUnauthorized) {
    handlers.onUnauthorized();
  }
  return Promise.reject(err);
};
