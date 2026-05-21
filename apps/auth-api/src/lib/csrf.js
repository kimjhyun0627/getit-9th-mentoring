/**
 * Double-submit CSRF 토큰 (Issue #312).
 *
 * 정책:
 *  - GET /api/csrf 에서 비밀 토큰을 발급 (서명된 HMAC).
 *  - 발급 시 두 가지 쿠키 등 → 의도적으로 한 쪽은 JS 접근 가능 (X-CSRF-Token 헤더로 전송용).
 *    - getit_csrf (HttpOnly): 검증용 원본
 *    - getit_csrf_pub (HttpOnly=false): FE 가 읽어서 X-CSRF-Token 헤더로 echo
 *  - 상태 변경 메서드 (POST/PUT/PATCH/DELETE) 는 두 값이 일치해야 통과.
 *  - SameSite=Lax 와 함께 — XSS 없는 한 cross-site form 공격을 차단.
 *
 * Exceptions:
 *  - /api/login, /api/signup, /api/password/forgot, /api/password/reset, /api/verify-email
 *    → 초기 진입점이라 토큰 없이 호출. rate-limit 으로 보호.
 *  - /api/refresh 는 SameSite=Lax + revoke 패턴으로 보호 — CSRF 면제.
 *  - GET / HEAD / OPTIONS 는 항상 통과.
 *
 * 토큰 형식: `random.b64hmac(random)`. 검증은 HMAC 비교만 → DB 라운드트립 없음.
 */
import crypto from 'node:crypto';

import { COOKIE_NAME as JWT_COOKIE } from '@getit/auth-utils/server';

export const CSRF_COOKIE_HTTP = 'getit_csrf';
export const CSRF_COOKIE_PUB = 'getit_csrf_pub';
export const CSRF_HEADER = 'x-csrf-token';

// /api/logout 은 CSRF 면제 — idempotent 하고 본인 세션만 revoke. 다른 web 앱이
// 토큰 없이 호출할 수 있어야 한다 (각 web 앱이 csrf prefetch 안 해도 동작).
// /api/me/* 만 보호 (프로필 변경/탈퇴/세션 revoke 가 CSRF 위험).
const CSRF_PROTECTED_PATHS = ['/api/me/profile', '/api/me/delete', '/api/me/sessions'];

/**
 * 토큰 발급용 시크릿 (jwt secret 재사용 — 추가 env 줄이기 위해).
 *
 * @returns {string}
 */
const getCsrfSecret = () => {
  const s = process.env.CSRF_SECRET || process.env.JWT_SECRET;
  if (!s || s.length < 16) throw new Error('CSRF_SECRET or JWT_SECRET must be >= 16 chars');
  return s;
};

/**
 * 새 CSRF 토큰 발급.
 *
 * @returns {string}
 */
export const issueCsrfToken = () => {
  const nonce = crypto.randomBytes(24).toString('hex');
  const sig = crypto.createHmac('sha256', getCsrfSecret()).update(nonce).digest('hex');
  return `${nonce}.${sig}`;
};

/**
 * 토큰 검증 — `nonce.sig` 형태 + HMAC 일치.
 *
 * @param {string | undefined | null} token
 * @returns {boolean}
 */
export const verifyCsrfToken = (token) => {
  if (!token || typeof token !== 'string') return false;
  const idx = token.indexOf('.');
  if (idx < 16) return false;
  const nonce = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = crypto.createHmac('sha256', getCsrfSecret()).update(nonce).digest('hex');
  if (expected.length !== sig.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
  } catch {
    return false;
  }
};

/**
 * Express 미들웨어: 상태 변경 메서드일 때 헤더 ↔ 쿠키 일치 + HMAC 검증.
 *
 * @returns {import('express').RequestHandler}
 */
export const csrfGuard = () => {
  return (req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    if (!CSRF_PROTECTED_PATHS.some((p) => req.path === p || req.path.startsWith(`${p}/`))) {
      return next();
    }
    // #427: 미인증 호출은 CSRF 검사 전에 라우터(requireAuth) 가 401 을 먼저 돌려주도록
    // skip 한다. 그렇지 않으면 unauth 사용자가 /api/me/delete 등에 접근 시
    // "CsrfTokenMismatch" 가 먼저 응답돼 API 응답 일관성이 깨지고 외부 모니터링이
    // 혼란스러워진다. JWT 쿠키 없으면 CSRF 검사도 의미 없음 (cross-site forge 불가).
    if (!req.cookies?.[JWT_COOKIE]) return next();
    const headerToken = req.headers[CSRF_HEADER];
    const cookieToken = req.cookies?.[CSRF_COOKIE_HTTP];
    if (!headerToken || !cookieToken || headerToken !== cookieToken) {
      return res.status(403).json({ error: 'CsrfTokenMismatch' });
    }
    if (!verifyCsrfToken(String(headerToken))) {
      return res.status(403).json({ error: 'CsrfTokenInvalid' });
    }
    return next();
  };
};

/**
 * GET /api/csrf — 토큰 발급 라우트에서 사용할 쿠키 set 헬퍼.
 *
 * @param {import('express').Response} res
 * @param {{ cookieDomain?: string, cookieSecure: boolean }} cfg
 * @returns {string} 발급된 토큰
 */
export const setCsrfCookies = (res, { cookieDomain, cookieSecure }) => {
  const token = issueCsrfToken();
  const opts = {
    sameSite: 'lax',
    secure: cookieSecure,
    domain: cookieDomain || undefined,
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  };
  res.cookie(CSRF_COOKIE_HTTP, token, { ...opts, httpOnly: true });
  res.cookie(CSRF_COOKIE_PUB, token, { ...opts, httpOnly: false });
  return token;
};
