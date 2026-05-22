import axios from 'axios';

/**
 * auth-web 전용 axios 인스턴스.
 * - baseURL: VITE_API_URL 우선, 없으면 '/api' (prod 동일 origin 가정)
 * - withCredentials: true — JWT는 HttpOnly 쿠키. .get-it.cloud 도메인 공유.
 *
 * Phase 6c (#312):
 *  - CSRF double-submit. 클라이언트는 mount 시 /api/csrf 한 번 호출 → 쿠키 + 토큰 캐싱.
 *  - 상태변경 요청 시 X-CSRF-Token 헤더 자동 첨부.
 */
const baseURL = import.meta.env?.VITE_API_URL ?? '/api';

export const client = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 10000,
});

/** @type {string | null} */
let csrfToken = null;

/**
 * /api/csrf 호출해서 토큰 캐시. mount 시 1회.
 * 실패해도 swallow — 다음 요청에서 자동 재시도.
 *
 * @returns {Promise<string | null>}
 */
export const ensureCsrfToken = async () => {
  if (csrfToken) return csrfToken;
  try {
    const { data } = await client.get('/csrf');
    csrfToken = data?.token ?? null;
    return csrfToken;
  } catch {
    return null;
  }
};

client.interceptors.request.use(async (config) => {
  const method = (config.method ?? 'get').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const t = await ensureCsrfToken();
    if (t) {
      config.headers = config.headers ?? {};
      config.headers['X-CSRF-Token'] = t;
    }
  }
  return config;
});

const handlers = { onUnauthorized: null };

export const setUnauthorizedHandler = (fn) => {
  handlers.onUnauthorized = fn;
};

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const url = String(err?.config?.url ?? '');
    const errorCode = err?.response?.data?.error;
    // #456: /refresh 의 실패 케이스 모두 onUnauthorized → /login redirect.
    //  - 401 NoRefreshToken: 쿠키 없음 (이미 만료/clear)
    //  - 401 InvalidRefreshToken: revoked / 이미 회전됨 (reuse detect)
    //  - 401 UserNotFound: 사용자 탈퇴 / deletedAt
    //  - 429 RateLimitExceeded: refresh 폭증 — 재시도 폭주 차단, 사용자는 로그인 페이지로.
    // CR 피드백: `/refresh?x=1` 같은 query 포함 케이스도 매칭되도록 regex.
    const isRefresh = /\/refresh(?:\?|$)/.test(url);
    if (isRefresh && (status === 401 || status === 429)) {
      if (handlers.onUnauthorized)
        handlers.onUnauthorized({ reason: errorCode ?? `HTTP${status}` });
      return Promise.reject(err);
    }
    if (status === 401 && handlers.onUnauthorized) handlers.onUnauthorized({ reason: errorCode });
    // CSRF mismatch (서버 재시작 등) → 토큰 캐시 비우고 다음 요청에서 재발급.
    if (status === 403 && err?.response?.data?.error?.startsWith?.('Csrf')) {
      csrfToken = null;
    }
    return Promise.reject(err);
  },
);

export const api = {
  login: (body) => client.post('/login', body),
  signup: (body) => client.post('/signup', body),
  // Cache-Control: no-cache — 라이브 버그 대응 (landing 304 사고). BE 도 no-store
  // 보내지만 클라이언트도 명시해 conditional GET 차단 → 항상 200 + body.
  me: () => client.get('/me', { headers: { 'Cache-Control': 'no-cache' } }),
  logout: () => client.post('/logout'),
  forgotPassword: (body) => client.post('/password/forgot', body),
  resetPassword: (body) => client.post('/password/reset', body),
  verifyEmail: (body) => client.post('/verify-email', body),
  resendVerifyEmail: () => client.post('/verify-email/resend'),
  updateProfile: (body) => client.patch('/me/profile', body),
  // #555: 닉네임 onboarding 전용 — currentPassword 재인증 없이 nickname 만 변경.
  updateNickname: (body) => client.patch('/me/nickname', body),
  deleteAccount: (body) => client.post('/me/delete', body),
  sessions: () => client.get('/me/sessions'),
  revokeOtherSessions: () => client.post('/me/sessions/revoke-others'),
  // school-auth #539 — 학교 메일 인증 (PRD `.claude/projects/school-auth.md`).
  //  - schoolLink: 최초 학교 메일 입력 + 인증 메일 발송.
  //  - schoolLinkResend: 같은 메일에 새 토큰 재발송 (분당 1건 rate limit).
  //  - verifySchool: 토큰 + 학번 8자리 → 인증 확정.
  schoolLink: (body) => client.post('/me/school-link', body),
  schoolLinkResend: (body) => client.post('/me/school-link/resend', body),
  verifySchool: (body) => client.post('/auth/verify-school', body),
};
